export function isPrivateIPv4(address) {
    if (typeof address !== 'string' || !/^(\d{1,3}\.){3}\d{1,3}$/.test(address))
        return false;
    const parts = address.split('.');
    if (parts.some(part => String(Number(part)) !== part || Number(part) > 255))
        return false;
    const [a, b] = parts.map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
