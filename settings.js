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
