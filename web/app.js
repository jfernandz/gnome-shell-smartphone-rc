import {createKeyboard} from './keyboard.js';
import {createTouchpad} from './touchpad.js';

const $ = id => document.getElementById(id);
const suppliedToken = location.hash.slice(1);
let token = suppliedToken || null;
try {
    if (suppliedToken)
        sessionStorage.setItem('pairingToken', suppliedToken);
    else
        token = sessionStorage.getItem('pairingToken');
} catch {
    // The scanned link still works when the browser disables tab storage.
}
function forgetToken() {
    token = null;
    try {
        sessionStorage.removeItem('pairingToken');
    } catch {
        // Storage may be unavailable in this browser context.
    }
}
history.replaceState(null, '', '/');
let socket = null;
let approved = false;
const keyboard = createKeyboard(send, () => approved);
const touchpad = createTouchpad(send, () => approved);

function send(message) {
    if (approved && socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(message));
}

function update(status, connected = false) {
    approved = connected;
    $('status').textContent = status;
    for (const id of ['keyboard', 'disconnect', 'left', 'right'])
        $(id).disabled = !connected;
    $('connect').disabled = socket !== null || !token;
    $('touchpad').classList.toggle('active', connected);
    if (!connected) {
        keyboard.hide();
        keyboard.reset();
        touchpad.reset();
    }
}

$('connect').addEventListener('click', () => {
    if (!token) {
        update('Scan the pairing QR code in the PC menu to connect.');
        return;
    }
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/control?token=${encodeURIComponent(token)}`);
    update('Connecting…');
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.type === 'focus' && approved) {
            keyboard.focus(message);
        }
        if (message.type === 'pending')
            update('Approve this connection in the PC top-bar menu.');
        if (message.type === 'approved') {
            forgetToken();
            update('Connected', true);
        }
    });
    socket.addEventListener('close', () => {
        socket = null;
        forgetToken();
        update('Disconnected. Start a new session on the PC and scan its QR code.');
    });
    socket.addEventListener('error', () => update('Connection failed. Check the network and restart the session on the PC.'));
});

$('disconnect').addEventListener('click', () => socket.close());

update(token ? 'Ready to connect' : 'Scan the pairing QR code in the PC menu to connect.');
