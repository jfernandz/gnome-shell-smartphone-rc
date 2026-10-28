import {DEFAULT_SENSITIVITY, isSensitivityRange} from './limits.js';

export function sensitivityRange(settings) {
    const range = {min: settings.get_double('sensitivity-min'), max: settings.get_double('sensitivity-max')};
    return isSensitivityRange(range) ? range : {...DEFAULT_SENSITIVITY};
}

export const TRUST_DURATIONS = Object.freeze([7, 30, 90]);

export function trustDurationDays(settings) {
    const days = settings.get_uint('trust-duration-days');
    return TRUST_DURATIONS.includes(days) ? days : TRUST_DURATIONS[0];
}

export const AUTO_STOP = Object.freeze({min: 1, max: 1440, default: 30});

export function autoStopMinutes(settings) {
    const minutes = settings.get_uint('auto-stop-minutes');
    return Number.isInteger(minutes) && minutes >= AUTO_STOP.min && minutes <= AUTO_STOP.max ? minutes : AUTO_STOP.default;
}
