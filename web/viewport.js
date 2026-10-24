export function trackViewport() {
    const viewport = globalThis.visualViewport;
    const keyboard = navigator.virtualKeyboard;
    function update() {
        const top = viewport?.offsetTop ?? 0;
        const height = viewport?.height ?? globalThis.innerHeight;
        const bounds = keyboard?.boundingRect;
        let bottom = top + height;
        if (bounds?.height > 0 && bounds.width > 0 && bounds.y >= top)
            bottom = Math.min(bottom, bounds.y);
        const style = document.documentElement.style;
        style.setProperty('--app-top', `${top}px`);
        style.setProperty('--app-height', `${Math.max(0, bottom - top)}px`);
    }
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    keyboard?.addEventListener('geometrychange', update);
    globalThis.addEventListener('resize', update);
    update();
}
