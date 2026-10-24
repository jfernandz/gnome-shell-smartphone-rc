const KEYS = new Set(['Enter', 'Backspace', 'Tab', 'Escape']);

export function validateInput(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message))
        return null;
    switch (message.type) {
    case 'move':
    case 'scroll':
        if ([message.dx, message.dy].every(value => Number.isFinite(value) && Math.abs(value) <= 500))
            return {type: message.type, dx: message.dx, dy: message.dy};
        break;
    case 'click':
        if (message.button === 1 || message.button === 3)
            return {type: 'click', button: message.button};
        break;
    case 'key':
        if (KEYS.has(message.key))
            return {type: 'key', key: message.key};
        break;
    case 'text':
        if (typeof message.text === 'string' && message.text.length > 0 && message.text.length <= 128 &&
            !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(message.text))
            return {type: 'text', text: message.text};
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
