export function sensitivityRange(settings) {
    const min = settings.get_double('sensitivity-min');
    const max = settings.get_double('sensitivity-max');
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0.5 || max > 20 ||
        min >= max || !Number.isInteger(min * 2) || !Number.isInteger(max * 2))
        return {min: 0.5, max: 10};
    return {min, max};
}
