const $ = id => document.getElementById(id);
const token = location.hash.slice(1);
history.replaceState(null, '', '/');
let socket = null;
let approved = false;

function send(message) {
    if (approved && socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(message));
}

function update(status, connected = false) {
    approved = connected;
    $('status').textContent = status;
    for (const id of ['keyboard', 'disconnect', 'left', 'right'])
        $(id).disabled = !connected;
    $('connect').disabled = socket !== null;
    $('touchpad').classList.toggle('active', connected);
    if (!connected) {
        $('typing').hidden = true;
        $('text').blur();
    }
}

$('connect').addEventListener('click', () => {
    if (!token) {
        update('Missing pairing link. Start a new session on the PC.');
        return;
    }
    socket = new WebSocket(`ws://${location.host}/control?token=${encodeURIComponent(token)}`);
    update('Connecting…');
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.type === 'pending')
            update('Approve this connection in the PC top-bar menu.');
        if (message.type === 'approved')
            update('Connected', true);
    });
    socket.addEventListener('close', () => {
        socket = null;
        points.clear();
        update('Disconnected. Start a new session on the PC.');
    });
    socket.addEventListener('error', () => update('Connection failed. Check the USB connection.'));
});

$('disconnect').addEventListener('click', () => socket.close());
$('keyboard').addEventListener('click', () => {
    $('typing').hidden = !$('typing').hidden;
    if (!$('typing').hidden)
        $('text').focus();
    else
        $('text').blur();
});
$('text-form').addEventListener('submit', event => {
    event.preventDefault();
    if ($('text').value) {
        send({type: 'text', text: $('text').value});
        $('text').value = '';
    }
});
for (const button of document.querySelectorAll('[data-key]'))
    button.addEventListener('click', () => send({type: 'key', key: button.dataset.key}));
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
    if (!approved)
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
        points.clear();
        tap = null;
        dx = dy = 0;
    }
});
