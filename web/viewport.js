export function trackViewport(environment = globalThis) {
    const {document, navigator} = environment;
    const viewport = environment.visualViewport;
    const keyboard = navigator.virtualKeyboard;
    function update() {
        const top = viewport?.offsetTop ?? 0;
        const height = viewport?.height ?? environment.innerHeight;
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
    environment.addEventListener('resize', update);
    update();
}
