import {createKeyboard} from './keyboard.js';
import {createVolume} from './volume.js';
import {createTouchpad} from './touchpad.js';
import {trackViewport} from './viewport.js';

const COOKIE_REFRESH_MS = 5 * 60 * 1000;
const RECOVERY_WINDOW_MS = 30 * 60 * 1000;
const CONNECT_TIMEOUT_MS = 10000;
const RESUME_TIMEOUT_MS = 3000;

export function createClient(environment = globalThis) {
    const {document, location, history, WebSocket, fetch, setTimeout, clearTimeout} = environment;
    const $ = id => document.getElementById(id);
    trackViewport(environment);
    const suppliedToken = location.hash.slice(1);
    let token = suppliedToken || null;
    try {
        if (suppliedToken)
            environment.sessionStorage.setItem('pairingToken', suppliedToken);
        else
            token = environment.sessionStorage.getItem('pairingToken');
    } catch {
        // The scanned link still works when the browser disables tab storage.
    }
    function forgetToken() {
        token = null;
        history.replaceState(null, '', '/');
        try {
            environment.sessionStorage.removeItem('pairingToken');
        } catch {
            // Storage may be unavailable in this browser context.
        }
    }
    let socket = null;
    let connectionEpoch = 0;
    let sessionRequest = 0;
    let sessionAbort = null;
    function invalidateConnection() {
        connectionEpoch++;
        sessionAbort?.abort();
        sessionAbort = null;
    }
    function beginSessionRequest() {
        sessionAbort?.abort();
        sessionAbort = new (environment.AbortController ?? globalThis.AbortController)();
        return sessionAbort.signal;
    }
    let state = 'disconnected';
    let typingPaused = false;
    let cookieSession = false;
    let cookieTimer = 0;
    let userDisconnected = false;
    let retryTimer = 0;
    let resumeTimer = 0;
    let retryCount = 0;
    let retryDeadline = 0;
    // Migrate away from the previous JS-readable reconnection credential.
    try {
        environment.sessionStorage.removeItem('resumeToken');
    } catch {
        // Cookie sessions do not depend on JavaScript storage.
    }
    function clearCookieTimer() {
        if (cookieTimer) {
            clearTimeout(cookieTimer);
            cookieTimer = 0;
        }
    }
    async function rememberSession(exchangeToken = null) {
        const epoch = connectionEpoch;
        const request = ++sessionRequest;
        const signal = beginSessionRequest();
        try {
            const response = await fetch('/session', {
                signal, method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: exchangeToken ? {Authorization: `Bearer ${exchangeToken}`} : {},
            });
            if (!response.ok)
                return;
            const session = await response.json();
            if (epoch !== connectionEpoch || request !== sessionRequest || userDisconnected)
                return;
            cookieSession = session?.authenticated === true;
            clearCookieTimer();
            if (cookieSession && state === 'connected' && !document.hidden)
                cookieTimer = setTimeout(() => rememberSession(), COOKIE_REFRESH_MS);
        } catch {
            // An interrupted refresh can be retried on return to the page.
        }
    }
    async function restoreSession(automatic = true) {
        const epoch = connectionEpoch;
        const request = ++sessionRequest;
        const signal = beginSessionRequest();
        try {
            const response = await fetch('/session', {signal, credentials: 'same-origin', cache: 'no-store'});
            if (!response.ok)
                return;
            const authenticated = (await response.json())?.authenticated === true;
            if (epoch !== connectionEpoch || request !== sessionRequest)
                return;
            cookieSession = authenticated;
            if (automatic && cookieSession && !socket && !userDisconnected && !document.hidden)
                connect(true);
            else if (!socket && cookieSession)
                transition('disconnected', 'Disconnected. Tap Connect to reconnect.');
        } catch {
            // Leave pairing available when the desktop is not reachable.
        }
    }
    function clearRetry() {
        if (resumeTimer) {
            clearTimeout(resumeTimer);
            resumeTimer = 0;
        }
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = 0;
        }
    }
    function reconnectLater() {
        clearRetry();
        if (!cookieSession)
            return;
        if (!retryDeadline)
            retryDeadline = Date.now() + RECOVERY_WINDOW_MS;
        if (Date.now() >= retryDeadline) {
            cookieSession = false;
            transition('disconnected', 'Session expired. Start a new session on the PC and scan its QR code.');
            return;
        }
        transition(document.hidden ? 'suspended' : 'reconnecting', document.hidden ? 'Paused. Return to Chrome to reconnect.' : 'Connection interrupted. Reconnecting…');
        if (!document.hidden) {
            retryTimer = setTimeout(() => {
                retryTimer = 0;
                connect(true);
            }, Math.min(250 * 2 ** retryCount++, 5000));
        }
    }
    const keyboard = createKeyboard(send, () => state === 'connected', environment);
    const volume = createVolume(send, () => state === 'connected' && !document.hidden, environment);
    const touchpad = createTouchpad(send, () => state === 'connected', environment);

    function send(message) {
        if (state === 'connected' && !document.hidden && socket?.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify(message));
    }

    function transition(next, status) {
        state = next;
        const connected = state === 'connected';
        $('status').textContent = status;
        for (const id of ['keyboard', 'disconnect', 'left', 'right'])
            $(id).disabled = !connected;
        $('connect').disabled = socket !== null || (!token && !cookieSession);
        $('touchpad').classList.toggle('active', connected);
        if (!connected) {
            keyboard.hide();
            keyboard.reset();
            touchpad.reset();
            volume.reset();
        }
    }

    function activateConnection(connection, message) {
        clearRetry();
        if (message.type === 'approved') {
            forgetToken();
            retryCount = 0;
            retryDeadline = 0;
        }
        if (typeof message.exchangeToken === 'string' && message.exchangeToken)
            rememberSession(message.exchangeToken);
        if (document.hidden) {
            connection.send(JSON.stringify({type: 'suspend'}));
            transition('suspended', 'Paused. Return to Chrome to resume.');
        } else {
            transition('connected', 'Connected');
        }
    }

    function handleMessage(connection, message) {
        if (message.type === 'volume-state')
            volume.update(message);
        if (message.type === 'focus' && (!Number.isSafeInteger(message.context) || message.context < 0 ||
            typeof message.active !== 'boolean' || (message.sensitive !== undefined && typeof message.sensitive !== 'boolean')))
            return;
        if (message.type === 'focus' && state === 'connected' && !document.hidden) {
            keyboard.focus(message);
            if (typingPaused) {
                typingPaused = false;
                transition('connected', 'Connected');
            }
        }
        if (message.type === 'trust-error')
            $('status').textContent = `Connected for this session only. ${message.message}`;
        if (message.type === 'typing-paused' && state === 'connected') {
            typingPaused = true;
            $('keyboard').disabled = true;
            keyboard.hide();
            keyboard.reset();
            $('status').textContent = 'Typing paused. Tap the PC text field again to resume.';
        }
        if (message.type === 'settings' || message.type === 'approved')
            touchpad.setRange(message.sensitivity);
        if (message.type === 'pending')
            transition('pending', 'On the PC, verify the browser certificate and approve.');
        if (message.type === 'approved' || message.type === 'resumed')
            activateConnection(connection, message);
        if (message.type === 'suspended')
            transition('suspended', 'Paused. Return to Chrome to resume.');
    }

    function connect(resuming = false) {
        if (socket || (!token && !cookieSession)) {
            if (!socket)
                transition('disconnected', 'Scan the pairing QR code in the PC menu to connect.');
            return;
        }
        clearRetry();
        userDisconnected = false;
        const pairing = cookieSession ? null : token;
        const connection = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/control`);
        socket = connection;
        invalidateConnection();
        retryTimer = setTimeout(() => {
            retryTimer = 0;
            if (socket === connection && connection.readyState === WebSocket.CONNECTING) {
                socket = null;
                invalidateConnection();
                connection.close();
                if (cookieSession)
                    reconnectLater();
                else
                    transition('disconnected', 'Could not reach the PC. Check the network and tap Connect again.');
            }
        }, CONNECT_TIMEOUT_MS);
        connection.addEventListener('open', () => {
            if (socket === connection) {
                clearRetry();
                if (pairing)
                    connection.send(JSON.stringify({type: 'authenticate', token: pairing}));
            }
        });
        transition(resuming ? 'reconnecting' : 'connecting', resuming ? 'Reconnecting…' : 'Connecting…');
        connection.addEventListener('message', event => {
            if (socket !== connection || userDisconnected)
                return;
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }
            if (!message || typeof message !== 'object' || Array.isArray(message))
                return;
            handleMessage(connection, message);
        });
        connection.addEventListener('close', event => {
            if (socket !== connection)
                return;
            clearRetry();
            clearCookieTimer();
            socket = null;
            invalidateConnection();
            typingPaused = false;
            forgetToken();
            const ended = event?.code === 1000 || event?.code === 1008;
            if (ended) {
                userDisconnected = true;
                cookieSession = false;
            }
            if (cookieSession)
                reconnectLater();
            else
                transition('disconnected', 'Disconnected. Start a new session on the PC and scan its QR code.');
            if (ended)
                restoreSession(false);
        });
        connection.addEventListener('error', () => {
            if (socket === connection)
                $('status').textContent = 'Connection interrupted. Waiting to reconnect…';
        });
    }

    $('connect').addEventListener('click', () => connect(Boolean(cookieSession)));
    $('disconnect').addEventListener('click', () => {
        userDisconnected = true;
        invalidateConnection();
        clearCookieTimer();
        clearRetry();
        cookieSession = false;
        if (socket?.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify({type: 'disconnect'}));
        transition('disconnected', 'Disconnected. Start a new session on the PC and scan its QR code.');
        socket?.close(1000, 'Disconnected by phone');
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearCookieTimer();
            clearRetry();
            if ((state === 'connected' || cookieSession) && socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({type: 'suspend'}));
                transition('suspended', 'Paused. Return to Chrome to resume.');
            }
        } else if (cookieSession && !userDisconnected) {
            if (socket?.readyState === WebSocket.OPEN) {
                const connection = socket;
                connection.send(JSON.stringify({type: 'resume'}));
                resumeTimer = setTimeout(() => {
                    resumeTimer = 0;
                    if (socket === connection) {
                        socket = null;
                        invalidateConnection();
                        connection.close();
                        connect(true);
                    }
                }, RESUME_TIMEOUT_MS);
            } else {
                const previous = socket;
                socket = null;
                invalidateConnection();
                previous?.close();
                connect(true);
            }
        }
    });

    transition('disconnected', token ? 'Ready to connect' : 'Scan the pairing QR code in the PC menu to connect.');
    if (!token)
        restoreSession();
}
