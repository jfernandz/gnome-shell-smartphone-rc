// Remote edits stay anchored at the end of the text written from this phone.
export function textChange(previous, next) {
    const before = Array.from(previous);
    const after = Array.from(next);
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
        prefix++;
    return {remove: before.length - prefix, text: after.slice(prefix).join('')};
}

export function editMessages(previous, next, context) {
    const change = textChange(previous, next);
    const messages = [];
    let remove = change.remove;
    while (remove > 512) {
        messages.push({type: 'edit', context, remove: 512, text: ''});
        remove -= 512;
    }
    let chunk = '';
    for (const character of change.text) {
        if (chunk.length + character.length > 512) {
            messages.push({type: 'edit', context, remove, text: chunk});
            remove = 0;
            chunk = '';
        }
        chunk += character;
    }
    if (remove || chunk)
        messages.push({type: 'edit', context, remove, text: chunk});
    return messages;
}
