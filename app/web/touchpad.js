import {DEFAULT_SENSITIVITY, SENSITIVITY, MAX_MOTION, isSensitivityRange, snapSensitivity} from '../../limits.js';

export function createTouchpad(send, isApproved, environment = globalThis) {
    const {document, requestAnimationFrame, cancelAnimationFrame, performance} = environment;
    const $ = id => document.getElementById(id);
    let sensitivity = 1;
    let range = {...DEFAULT_SENSITIVITY};
    try {
        const saved = Number(environment.localStorage.getItem('pointerSensitivity'));
        if (Number.isFinite(saved) && saved >= SENSITIVITY.min && saved <= SENSITIVITY.max)
            sensitivity = snapSensitivity(saved);
    } catch {
        // Pointer control still works when the browser blocks storage.
    }
    function showSensitivity() {
        $('sensitivity').value = String(sensitivity);
        $('sensitivity').ariaValueText = `${sensitivity.toFixed(1)} times`;
        $('sensitivity-value').textContent = `${sensitivity.toFixed(1)}×`;
    }
    showSensitivity();
    $('sensitivity').addEventListener('input', () => {
        const value = Number($('sensitivity').value);
        if (!Number.isFinite(value) || value < range.min || value > range.max)
            return;
        sensitivity = snapSensitivity(value);
        showSensitivity();
        try {
            environment.localStorage.setItem('pointerSensitivity', String(sensitivity));
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
            send({type: motionType, dx: Math.max(-MAX_MOTION, Math.min(MAX_MOTION, dx)), dy: Math.max(-MAX_MOTION, Math.min(MAX_MOTION, dy))});
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
        if (!isSensitivityRange(next))
            return;
        range = next;
        $('sensitivity').min = String(range.min);
        $('sensitivity').max = String(range.max);
        sensitivity = Math.max(range.min, Math.min(range.max, sensitivity));
        showSensitivity();
        try {
            environment.localStorage.setItem('pointerSensitivity', String(sensitivity));
        } catch {
            // The live range still applies when storage is unavailable.
        }
    }
    return {reset, setRange};
}
