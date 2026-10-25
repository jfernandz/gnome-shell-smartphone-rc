import {DEFAULT_SENSITIVITY, isSensitivityRange} from './limits.js';

export function sensitivityRange(settings) {
    const range = {min: settings.get_double('sensitivity-min'), max: settings.get_double('sensitivity-max')};
    return isSensitivityRange(range) ? range : {...DEFAULT_SENSITIVITY};
}
