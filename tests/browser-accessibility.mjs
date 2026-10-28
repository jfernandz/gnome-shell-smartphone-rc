import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export async function checkBrowserAccessibility(page, outputDirectory = null) {
    async function group() {
        await page.evaluate(`(() => {
            const panel = document.querySelector('#controls');
            if (!panel.matches(':popover-open')) document.querySelector('#controls-toggle').click();
        })()`);
        // Measure the final card, not its opening animation.
        await page.evaluate("Promise.all(document.getAnimations().map(animation => animation.finished))");
    }
    async function screenshot(name) {
        if (!outputDirectory) return;
        await page.evaluate("Promise.all(document.getAnimations().map(animation => animation.finished))");
        mkdirSync(outputDirectory, {recursive: true});
        const result = await page.call('Page.captureScreenshot', {format: 'png'});
        writeFileSync(join(outputDirectory, name + '.png'), Buffer.from(result.data, 'base64'));
    }
    try {
        for (const [width, height, fontSize] of [[360, 800, 16], [320, 568, 16], [568, 320, 16], [844, 390, 16], [568, 240, 16], [844, 180, 16], [568, 320, 32], [320, 568, 32]]) {
            await page.call('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: true});
            await page.evaluate(`document.documentElement.style.fontSize = '${fontSize}px'`);
            for (const value of ['all']) {
                await group(value);
                const layout = await page.evaluate(`(async () => {
                    await new Promise(requestAnimationFrame);
                    const panel = document.querySelector('#controls');
                    const box = panel.getBoundingClientRect();
                    const controls = [...panel.querySelectorAll('button, input, select')].filter(node => node.getClientRects().length);
                    return {bounds: box.toJSON(), font: getComputedStyle(panel).font, fits: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth,
                        scroll: panel.scrollHeight > panel.clientHeight + 1 || document.body.scrollHeight > document.body.clientHeight + 1,
                        targets: controls.map(node => {const rect = node.getBoundingClientRect(); return {id: node.id, height: rect.height, fits: rect.top >= box.top && rect.bottom <= box.bottom && rect.left >= box.left && rect.right <= box.right};})};
                })()`);
                assert.ok(layout.fits && !layout.scroll, `Panel needs scrolling at ${width}×${height}/${fontSize}/${value}: ${JSON.stringify(layout)}`);
                for (const target of layout.targets)
                    assert.ok(target.fits && target.height >= 44, `Clipped or small control: ${JSON.stringify(target)}`);
                await screenshot(`controls-${width}x${height}-${fontSize}-${value}`);
            }
            await page.evaluate('document.querySelector("#controls").hidePopover()');
            const closed = await page.evaluate(`(() => {
                const pad = document.querySelector('#touchpad').getBoundingClientRect();
                return {hidden: !document.querySelector('#controls').matches(':popover-open'),
                    fits: pad.bottom <= innerHeight && pad.height >= innerHeight - 90,
                    scroll: document.body.scrollHeight > document.body.clientHeight + 1};
            })()`);
            assert.ok(closed.hidden && closed.fits && !closed.scroll, JSON.stringify(closed));
            await screenshot(`touchpad-${width}x${height}-${fontSize}`);
        }
        console.log('PASS: direct controls fit without scrolling in portrait, landscape, short viewports and 200% text; closed panel maximizes touchpad');
        await page.evaluate('document.documentElement.style.fontSize = ""');
        await page.call('Emulation.clearDeviceMetricsOverride');
        await group('sound');
        const {nodes} = await page.call('Accessibility.getFullAXTree');
        assert.ok(nodes.some(node => node.role?.value === 'slider' && node.name?.value === 'Volume'));
        assert.ok(nodes.some(node => node.role?.value === 'button' && node.name?.value === 'Mute'));
        for (const label of ['Lock PC', 'Suspend PC'])
            assert.ok(nodes.some(node => node.role?.value === 'button' && node.name?.value === label));
        const cancelled = await page.evaluate(`(() => {
            const confirm = window.confirm;
            window.confirm = () => false;
            try {
                document.querySelector('#lock-pc').click();
                document.querySelector('#suspend-pc').click();
            } finally { window.confirm = confirm; }
            return document.querySelector('#status').textContent;
        })()`);
        assert.equal(cancelled, 'Connected');
        await group('pointer');
        const tree = await page.call('Accessibility.getFullAXTree');
        assert.ok(tree.nodes.some(node => node.role?.value === 'slider' && node.name?.value === 'Sensitivity'));
        await group('connection');
        await page.evaluate('document.querySelector("#keyboard").focus()');
        await page.call('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
        await page.call('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
        assert.equal(await page.evaluate('document.querySelector("#controls").matches(":popover-open")'), false);
        assert.equal(await page.evaluate('document.activeElement.id'), 'controls-toggle');
        await group('connection');
        await page.evaluate('document.querySelector("#keyboard").click()');
        assert.equal(await page.evaluate('document.activeElement.id'), 'text');
        assert.equal(await page.evaluate('document.querySelector("#controls").matches(":popover-open")'), false);
        await page.evaluate('document.querySelector("#text").value = "rotation"; document.querySelector("#text").setSelectionRange(2, 5)');
        for (const [width, height] of [[360, 800], [844, 390], [844, 180], [360, 800]]) {
            await page.call('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: true});
            const editor = await page.evaluate(`(async () => {
                await new Promise(requestAnimationFrame);
                const input = document.querySelector('#text');
                const box = input.getBoundingClientRect();
                return {focus: document.activeElement.id, value: input.value, start: input.selectionStart, end: input.selectionEnd,
                    fits: box.bottom <= innerHeight && box.top >= 0, scroll: document.body.scrollHeight > document.body.clientHeight + 1};
            })()`);
            assert.deepEqual(editor, {focus: 'text', value: 'rotation', start: 2, end: 5, fits: true, scroll: false});
            await screenshot(`typing-${width}x${height}`);
        }
        await page.evaluate('document.querySelector("#text").value = ""');
        await page.call('Emulation.clearDeviceMetricsOverride');
        await group('connection');
        await page.evaluate('document.querySelector("#keyboard").click()');
        assert.equal(await page.evaluate('document.querySelector("#keyboard").getAttribute("aria-expanded")'), 'false');
        console.log('PASS: named controls, Escape dismissal/focus restoration, keyboard disclosure and editor selection across rotation');
        const colors = await page.evaluate(`['#controls-toggle', '#touchpad-help'].map(selector => {
            const element = document.querySelector(selector);
            return {foreground: getComputedStyle(element).color,
                background: getComputedStyle(document.querySelector(selector === '#controls-toggle' ? '#controls-toggle' : selector === '#status' ? ':root' : '#touchpad')).backgroundColor};
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
        console.log('PASS: enabled button and touchpad-help text have at least 4.5:1 contrast');
    } finally {
        await page.evaluate('document.documentElement.style.fontSize = ""; document.querySelector("#controls").hidePopover()');
        await page.call('Emulation.clearDeviceMetricsOverride');
    }
}
