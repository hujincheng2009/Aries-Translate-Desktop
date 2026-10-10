export function isServiceAvailable(instanceKey, builtins, plugins = {}) {
    if (typeof instanceKey !== 'string') return false;
    const name = instanceKey.split('@')[0];
    return name.startsWith('plugin')
        ? Object.prototype.hasOwnProperty.call(plugins ?? {}, name)
        : Object.prototype.hasOwnProperty.call(builtins ?? {}, name);
}

export function filterAvailableServices(list, builtins, plugins = {}, onMissing) {
    return (Array.isArray(list) ? list : []).filter((key) => {
        const available = isServiceAvailable(key, builtins, plugins);
        if (!available) onMissing?.(key);
        return available;
    });
}
