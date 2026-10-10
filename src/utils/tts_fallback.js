import { createCooldownStore } from './cooldown_store.js';
export const TTS_COOLDOWN_STORAGE_KEY = 'pot_tts_cooldowns';
const PACIFIC_ZONE = 'America/Los_Angeles';

function pacificParts(timestamp) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PACIFIC_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(timestamp);
    return Object.fromEntries(
        parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])
    );
}

export function nextPacificMidnight(now = Date.now()) {
    const current = pacificParts(now);
    const nextDate = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
    const target = Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
    let guess = target + 8 * 60 * 60 * 1000;
    for (let index = 0; index < 4; index += 1) {
        const local = pacificParts(guess);
        const observed = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
        const difference = target - observed;
        guess += difference;
        if (difference === 0) break;
    }
    return guess;
}

export function createTtsCooldownStore({ storage = () => globalThis.localStorage, now = Date.now } = {}) {
    return createCooldownStore({
        storageKey: TTS_COOLDOWN_STORAGE_KEY,
        kinds: ['quota_daily', 'rate_limited'],
        storage,
        now,
        resolveUntil: (failure, timestamp) =>
            failure?.kind === 'quota_daily'
                ? Number.isFinite(failure.resetAt)
                    ? failure.resetAt
                    : nextPacificMidnight(timestamp) + 60_000
                : failure?.kind === 'rate_limited'
                  ? timestamp + (Number.isFinite(failure.retryAfterMs) ? Math.max(0, failure.retryAfterMs) : 60_000)
                  : null,
    });
}

export const ttsCooldowns = createTtsCooldownStore();
export const clearTtsCooldown = (instanceKey) => ttsCooldowns.clear(instanceKey);

function credentials(config, values = []) {
    if (!config || typeof config !== 'object') return values;
    for (const [key, value] of Object.entries(config)) {
        if (key === 'instanceName') continue;
        if (typeof value === 'string' && value.length >= 6) values.push(value);
        else if (value && typeof value === 'object') credentials(value, values);
    }
    return values;
}

export function sanitizeTtsFailureMessage(error, config = {}) {
    let message = error instanceof Error ? error.message : String(error ?? 'Unknown TTS failure');
    for (const value of credentials(config).sort((a, b) => b.length - a.length)) {
        message = message.split(value).join('[REDACTED]');
    }
    return message
        .replace(/\bBearer\s+[^\s,'"}]+/gi, 'Bearer [REDACTED]')
        .replace(
            /(\b(?:api[_-]?key|key|token|secret|password|authorization|x-goog-api-key)\s*[:=]\s*)[^\s&,'"}]+/gi,
            '$1[REDACTED]'
        )
        .slice(0, 2000);
}

export async function runTtsFallback({
    text,
    serviceInstanceList,
    language,
    getConfig,
    getMetadata,
    synthesize,
    cooldowns = ttsCooldowns,
    now = Date.now,
    shouldContinue = () => true,
}) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('No text selected');
    if (!Array.isArray(serviceInstanceList) || !serviceInstanceList.length)
        throw new Error('No TTS service configured');
    const active = cooldowns.read();
    const available = serviceInstanceList.filter((key) => !active[key] || active[key].until <= now());
    const candidates = available.length ? available : serviceInstanceList;
    const failures = [];
    let detectedLanguage;
    const detectOnce = async () => {
        if (language.mode === 'fixed') return language.language;
        detectedLanguage ??= Promise.resolve().then(() => language.detect(text));
        return detectedLanguage;
    };
    for (const serviceInstanceKey of candidates) {
        if (!shouldContinue()) throw new Error('TTS request cancelled');
        let config = {};
        let metadata = {
            serviceName: serviceInstanceKey.split('@')[0],
            serviceLabel: serviceInstanceKey.split('@')[0],
        };
        try {
            config = (await getConfig(serviceInstanceKey)) ?? {};
            metadata.serviceLabel = config.instanceName?.trim() || metadata.serviceName;
            metadata = await getMetadata(serviceInstanceKey, config);
            const result = await synthesize({ serviceInstanceKey, config, metadata, text, language, detectOnce });
            if (result?.data == null || (typeof result.data.length === 'number' && result.data.length === 0)) {
                throw new Error('TTS service returned no audio');
            }
            return {
                ...result,
                serviceInstanceKey,
                serviceName: metadata.serviceName,
                instanceName: config.instanceName ?? '',
                serviceLabel: metadata.serviceLabel,
                failures,
            };
        } catch (error) {
            const kind = error?.ttsFailure?.kind ?? 'other';
            const failure = {
                serviceInstanceKey,
                serviceLabel: metadata.serviceLabel,
                kind,
                message: sanitizeTtsFailureMessage(error, config),
            };
            if (kind === 'quota_daily' || kind === 'rate_limited') {
                failure.cooldownUntil = cooldowns.record(serviceInstanceKey, error.ttsFailure);
            }
            failures.push(failure);
        }
    }
    const aggregate = new Error(failures.map((failure) => `${failure.serviceLabel}: ${failure.message}`).join('\n'));
    aggregate.failures = failures;
    throw aggregate;
}

export function formatTtsFallbackNotice(failures, actualServiceLabel, t, now = Date.now()) {
    const lines = failures.map((failure) => {
        let reason = failure.message;
        if (failure.kind === 'auth') {
            const key = /API key not valid|API_KEY_INVALID/i.test(reason) ? 'api_key_invalid' : 'auth';
            reason = `${t(`read_aloud.fallback.${key}`)} ${reason}`;
        }
        if (failure.kind === 'rate_limited') {
            const seconds = Math.max(1, Math.ceil(((failure.cooldownUntil ?? now + 60_000) - now) / 1000));
            reason = `${t('read_aloud.fallback.rate_limited', { seconds })} ${reason}`;
        }
        if (failure.kind === 'quota_daily') {
            const reset = new Date(failure.cooldownUntil ?? now).toLocaleString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                ...(new Date(failure.cooldownUntil ?? now).toDateString() !== new Date(now).toDateString()
                    ? { month: 'numeric', day: 'numeric' }
                    : {}),
            });
            reason = `${t('read_aloud.fallback.quota_daily', { time: reset })} ${reason}`;
        }
        return t('read_aloud.fallback.failed', { service: failure.serviceLabel, reason });
    });
    lines.push(
        actualServiceLabel
            ? t('read_aloud.fallback.switched', { service: actualServiceLabel })
            : t('read_aloud.fallback.all_failed')
    );
    return lines.join('\n');
}
