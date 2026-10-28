import {MAX_MOTION, MAX_EDIT} from './limits.js';

export function validateInput(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message))
        return null;
    switch (message.type) {
    case 'suspend':
    case 'resume':
    case 'disconnect':
        return {type: message.type};
    case 'session-action':
        if (message.action === 'lock' || message.action === 'suspend')
            return {type: 'session-action', action: message.action};
        break;
    case 'volume':
    case 'mute':
        if (!Number.isInteger(message.output) || message.output < 0 || message.output > 0xffffffff)
            break;
        if (message.type === 'volume' && Number.isInteger(message.level) && message.level >= 0 && message.level <= 100)
            return {type: 'volume', output: message.output, level: message.level};
        if (message.type === 'mute' && typeof message.muted === 'boolean')
            return {type: 'mute', output: message.output, muted: message.muted};
        break;
    case 'move':
    case 'scroll':
        if ([message.dx, message.dy].every(value => Number.isFinite(value) && Math.abs(value) <= MAX_MOTION))
            return {type: message.type, dx: message.dx, dy: message.dy};
        break;
    case 'click':
        if (message.button === 1 || message.button === 3)
            return {type: 'click', button: message.button};
        break;
    case 'edit':
        if (Number.isSafeInteger(message.context) && message.context >= 0 &&
            Number.isInteger(message.remove) && message.remove >= 0 && message.remove <= MAX_EDIT &&
            typeof message.text === 'string' && message.text.length <= MAX_EDIT &&
            // eslint-disable-next-line no-control-regex -- Reject control characters and lone surrogates in remote text.
            !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(message.text))
            return {type: 'edit', context: message.context, remove: message.remove, text: message.text};
        break;
    case 'key':
        if (message.key === 'Enter' && Number.isSafeInteger(message.context) && message.context >= 0)
            return {type: 'key', key: 'Enter', context: message.context};
        break;
    }
    return null;
}

export class RateLimit {
    constructor() {
        this._start = 0;
        this._count = 0;
    }

    accept(now) {
        if (now - this._start >= 1000) {
            this._start = now;
            this._count = 0;
        }
        return ++this._count <= 240;
    }
}

export function isVolumeState(message) {
    return message?.type === 'volume-state' && typeof message.available === 'boolean' &&
        Number.isInteger(message.output) && message.output >= (message.available ? 0 : -1) &&
        message.output <= 0xffffffff && (message.available || message.output === -1) &&
        Number.isInteger(message.level) && message.level >= 0 && message.level <= 100 &&
        typeof message.muted === 'boolean';
}
