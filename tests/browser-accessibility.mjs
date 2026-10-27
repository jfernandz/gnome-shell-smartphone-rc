import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export async function checkBrowserAccessibility(page, outputDirectory = null) {
    async function key(key, code, virtualKey, shiftKey = false) {
        const params = {key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey, modifiers: shiftKey ? 8 : 0};
        await page.call('Input.dispatchKeyEvent', {type: 'keyDown', ...params, ...(key === 'Enter' ? {text: '\r', unmodifiedText: '\r'} : {})});
        await page.call('Input.dispatchKeyEvent', {type: 'keyUp', ...params});
    }
    try {
        for (const [width, height, fontSize] of [[360, 800, 16], [320, 568, 16], [568, 320, 16], [320, 568, 32]]) {
            await page.call('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: true});
            const layout = await page.evaluate(`(async()=>{
                document.documentElement.style.fontSize = '${fontSize}px';
                await new Promise(requestAnimationFrame);
                const visible = [...document.querySelectorAll('button, input[type="range"]')].filter(node => node.getClientRects().length);
                const pad = document.querySelector('#touchpad').getBoundingClientRect();
                const help = document.querySelector('#touchpad-help').getBoundingClientRect();
                return {width: innerWidth, content: document.documentElement.scrollWidth,
                    helpFits: help.top >= pad.top && help.bottom <= pad.bottom && help.left >= pad.left && help.right <= pad.right,
                    controls: visible.map(node => ({id: node.id, height: node.getBoundingClientRect().height,
                        left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right}))};
            })()`);
            assert.ok(layout.content <= layout.width + 1, `Horizontal overflow at ${width}×${height}, ${fontSize}px: ${JSON.stringify(layout)}`);
            assert.ok(layout.helpFits, `Touchpad instructions clipped at ${width}×${height}, ${fontSize}px`);
            for (const control of layout.controls) {
                assert.ok(control.height >= 44, `Small target: ${JSON.stringify(control)}`);
                assert.ok(control.left >= 0 && control.right <= layout.width + 1, `Clipped control: ${JSON.stringify(control)}`);
            }
            if (outputDirectory) {
                mkdirSync(outputDirectory, {recursive: true});
                const screenshot = await page.call('Page.captureScreenshot', {format: 'png'});
                writeFileSync(join(outputDirectory, `mobile-${width}x${height}-${fontSize}px.png`), Buffer.from(screenshot.data, 'base64'));
            }
        }
        console.log('PASS: mobile portrait/landscape and 200% text retain controls without horizontal overflow; targets are at least 44px high');
        await page.evaluate('document.documentElement.style.fontSize = ""');
        await page.call('Emulation.clearDeviceMetricsOverride');
        await page.evaluate('document.querySelector("#keyboard").focus()');
        for (const id of ['disconnect', 'sensitivity', 'volume', 'mute', 'left', 'right']) {
            await key('Tab', 'Tab', 9);
            assert.equal(await page.evaluate('document.activeElement.id'), id);
        }
        await key('Tab', 'Tab', 9, true);
        assert.equal(await page.evaluate('document.activeElement.id'), 'left');
        const outline = await page.evaluate('getComputedStyle(document.activeElement).outlineStyle');
        assert.notEqual(outline, 'none');
        console.log('PASS: keyboard focus follows visible controls in both directions with a visible outline');

        const {nodes} = await page.call('Accessibility.getFullAXTree');
        assert.ok(nodes.some(node => node.role?.value === 'slider' && node.name?.value === 'Sensitivity'));
        assert.ok(nodes.some(node => node.role?.value === 'slider' && node.name?.value === 'Volume'));
        assert.ok(nodes.some(node => node.role?.value === 'button' && node.name?.value === 'Mute'));
        assert.ok(nodes.some(node => node.role?.value === 'button' && node.name?.value === 'Keyboard'));
        await page.evaluate('document.querySelector("#keyboard").focus()');
        await key('Enter', 'Enter', 13);
        assert.equal(await page.evaluate('document.querySelector("#keyboard").getAttribute("aria-expanded")'), 'true');
        assert.equal(await page.evaluate('document.activeElement.id'), 'text');
        assert.equal(await page.evaluate('document.querySelector("#text").labels[0].textContent'), 'Typing on your PC');
        // A desktop field change can close the editor while it still owns focus.
        await page.evaluate('document.querySelector("#keyboard").click()');
        assert.equal(await page.evaluate('document.querySelector("#keyboard").getAttribute("aria-expanded")'), 'false');
        assert.equal(await page.evaluate('document.activeElement.id'), 'keyboard');
        console.log('PASS: browser accessibility tree names controls; keyboard disclosure state and focus restoration stay synchronized');
        const colors = await page.evaluate(`['#keyboard', '#status', '#touchpad-help'].map(selector => {
            const element = document.querySelector(selector);
            return {foreground: getComputedStyle(element).color,
                background: getComputedStyle(document.querySelector(selector === '#keyboard' ? '#keyboard' : selector === '#status' ? ':root' : '#touchpad')).backgroundColor};
        })`);
        const luminance = color => {
            const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(value => {
                const channel = Number(value) / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        for (const {foreground, background} of colors) {
            const a = luminance(foreground), b = luminance(background);
            assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `Low text contrast: ${foreground} on ${background}`);
        }
        console.log('PASS: enabled button, status and touchpad-help text have at least 4.5:1 contrast');
    } finally {
        await page.evaluate('document.documentElement.style.fontSize = ""');
        await page.call('Emulation.clearDeviceMetricsOverride');
    }
}
