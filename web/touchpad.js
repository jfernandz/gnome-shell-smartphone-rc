export function createTouchpad(send, isApproved) {
    const $ = id => document.getElementById(id);
    let sensitivity = 1;
    let range = {min: 0.5, max: 10};
    try {
        const saved = Number(localStorage.getItem('pointerSensitivity'));
        if (Number.isFinite(saved) && saved >= 0.5 && saved <= 20)
            sensitivity = Math.round(saved * 2) / 2;
    } catch {
        // Pointer control still works when the browser blocks storage.
    }
    function showSensitivity() {
        $('sensitivity').value = String(sensitivity);
        $('sensitivity-value').textContent = `${sensitivity.toFixed(1)}×`;
    }
    showSensitivity();
    $('sensitivity').addEventListener('input', () => {
        const value = Number($('sensitivity').value);
        if (!Number.isFinite(value) || value < range.min || value > range.max)
            return;
        sensitivity = Math.round(value * 2) / 2;
        showSensitivity();
        try {
            localStorage.setItem('pointerSensitivity', String(sensitivity));
        } catch {
            // Keep the chosen value for this page even if it cannot be saved.
        }
    });
    $('left').addEventListener('click', () => send({type: 'click', button: 1}));
    $('right').addEventListener('click', () => send({type: 'click', button: 3}));

    const points = new Map();
    let tap = null;
    let multi = false;
    let dx = 0;
    let dy = 0;
    let frame = 0;
    let motionType = 'move';
    const pad = $('touchpad');

    function flush() {
        if (frame)
            cancelAnimationFrame(frame);
        if (dx || dy)
            send({type: motionType, dx: Math.max(-500, Math.min(500, dx)), dy: Math.max(-500, Math.min(500, dy))});
        dx = dy = 0;
        frame = 0;
    }

    pad.addEventListener('pointerdown', event => {
        if (!isApproved())
            return;
        flush();
        pad.setPointerCapture(event.pointerId);
        points.set(event.pointerId, {x: event.clientX, y: event.clientY});
        if (points.size === 1) {
            tap = {x: event.clientX, y: event.clientY, time: performance.now(), moved: false};
            multi = false;
        } else {
            multi = true;
        }
    });
    pad.addEventListener('pointermove', event => {
        const previous = points.get(event.pointerId);
        if (!previous)
            return;
        const nextType = points.size >= 2 ? 'scroll' : 'move';
        if (motionType !== nextType)
            flush();
        motionType = nextType;
        const scale = nextType === 'scroll' ? 1 / points.size : sensitivity;
        dx += (event.clientX - previous.x) * scale;
        dy += (event.clientY - previous.y) * scale;
        points.set(event.pointerId, {x: event.clientX, y: event.clientY});
        if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8)
            tap.moved = true;
        if (!frame)
            frame = requestAnimationFrame(flush);
    });
    function endPointer(event) {
        if (!points.has(event.pointerId))
            return;
        flush();
        points.delete(event.pointerId);
        if (event.type === 'pointerup' && !multi && tap && !tap.moved && performance.now() - tap.time < 300)
            send({type: 'click', button: 1});
        tap = null;
    }
    pad.addEventListener('pointerup', endPointer);
    pad.addEventListener('pointercancel', endPointer);
    pad.addEventListener('lostpointercapture', endPointer);
    pad.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            reset();
        }
    });

    function reset() {
        if (frame)
            cancelAnimationFrame(frame);
        frame = 0;
        points.clear();
        tap = null;
        multi = false;
        dx = dy = 0;
    }
    function setRange(next) {
        if (!next || !Number.isFinite(next.min) || !Number.isFinite(next.max) ||
            next.min < 0.5 || next.max > 20 || next.min >= next.max ||
            !Number.isInteger(next.min * 2) || !Number.isInteger(next.max * 2))
            return;
        range = next;
        $('sensitivity').min = String(range.min);
        $('sensitivity').max = String(range.max);
        sensitivity = Math.max(range.min, Math.min(range.max, sensitivity));
        showSensitivity();
        try {
            localStorage.setItem('pointerSensitivity', String(sensitivity));
        } catch {
            // The live range still applies when storage is unavailable.
        }
    }
    return {reset, setRange};
}
