export const SENSITIVITY = Object.freeze({min: 0.5, max: 20, step: 0.5, defaultMin: 0.5, defaultMax: 10});
export const DEFAULT_SENSITIVITY = Object.freeze({min: SENSITIVITY.defaultMin, max: SENSITIVITY.defaultMax});
export const MAX_MOTION = 500;
export const MAX_EDIT = 512;

export function isSensitivityRange(range) {
    return Boolean(range && Number.isFinite(range.min) && Number.isFinite(range.max) &&
        range.min >= SENSITIVITY.min && range.max <= SENSITIVITY.max && range.min < range.max &&
        Number.isInteger(range.min / SENSITIVITY.step) && Number.isInteger(range.max / SENSITIVITY.step));
}

export function snapSensitivity(value) {
    return Math.round(value / SENSITIVITY.step) * SENSITIVITY.step;
}
