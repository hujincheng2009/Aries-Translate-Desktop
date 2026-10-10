export function createCooldownStore({
    storageKey,
    kinds,
    resolveUntil,
    storage = () => globalThis.localStorage,
    now = Date.now,
}) {
    let memory = {};
    let available = true;
    const target = () => (typeof storage === 'function' ? storage() : storage);
    const write = (value) => {
        memory = value;
        if (!available) return;
        try {
            target().setItem(storageKey, JSON.stringify(value));
        } catch {
            available = false;
        }
    };
    const read = () => {
        if (available) {
            try {
                const raw = target().getItem(storageKey);
                memory = raw ? JSON.parse(raw) : {};
                if (!memory || typeof memory !== 'object' || Array.isArray(memory)) memory = {};
            } catch {
                available = false;
            }
        }
        const active = Object.fromEntries(
            Object.entries(memory).filter(
                ([, value]) =>
                    value && Number.isFinite(value.until) && value.until > now() && kinds.includes(value.kind)
            )
        );
        if (Object.keys(active).length !== Object.keys(memory).length) write(active);
        return active;
    };
    return {
        read,
        record(key, failure) {
            const until = resolveUntil(failure, now());
            if (!Number.isFinite(until) || until <= now() || !kinds.includes(failure?.kind)) return;
            const active = read();
            active[key] = { until, kind: failure.kind };
            write(active);
            return until;
        },
        clear(key) {
            const active = read();
            delete active[key];
            write(active);
        },
        clearWhere(predicate) {
            write(Object.fromEntries(Object.entries(read()).filter(([key]) => !predicate(key))));
        },
    };
}
