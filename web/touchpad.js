export function createTouchpad(send, isApproved) {
    const $ = id => document.getElementById(id);
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
        dx += (event.clientX - previous.x) / (nextType === 'scroll' ? points.size : 1);
        dy += (event.clientY - previous.y) / (nextType === 'scroll' ? points.size : 1);
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
    return {reset};
}
