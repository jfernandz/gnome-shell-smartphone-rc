import {isVolumeState} from '../../protocol.js';

export function createVolume(send, isApproved, environment = globalThis) {
    const $ = id => environment.document.getElementById(id);
    let state = null;
    function reset() {
        state = null;
        $('volume').disabled = true;
        $('mute').disabled = true;
        $('volume').value = '0';
        $('volume-value').textContent = 'Unavailable';
        $('mute').textContent = 'Mute';
        $('mute').setAttribute('aria-pressed', 'false');
    }
    $('volume').addEventListener('input', () => {
        const level = Number($('volume').value);
        if (!isApproved() || !state?.available || !Number.isInteger(level) || level < 0 || level > 100) return;
        $('volume-value').textContent = `${level}%`;
        send({type: 'volume', output: state.output, level});
    });
    $('mute').addEventListener('click', () => {
        if (isApproved() && state?.available)
            send({type: 'mute', output: state.output, muted: !state.muted});
    });
    reset();
    return {
        reset,
        update(message) {
            if (!isApproved() || !isVolumeState(message)) return;
            state = message;
            $('volume').disabled = !state.available;
            $('mute').disabled = !state.available;
            $('volume').value = String(state.level);
            $('volume-value').textContent = state.available ? `${state.level}%` : 'Unavailable';
            $('mute').textContent = state.muted ? 'Unmute' : 'Mute';
            $('mute').setAttribute('aria-pressed', String(state.muted));
        },
    };
}
