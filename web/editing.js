// Remote edits stay anchored at the end of the text written from this phone.
export function textChange(previous, next) {
    const before = Array.from(previous);
    const after = Array.from(next);
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
        prefix++;
    return {remove: before.length - prefix, text: after.slice(prefix).join('')};
}

export function recentText(text) {
    return Array.from(text).slice(-128).join('');
}
