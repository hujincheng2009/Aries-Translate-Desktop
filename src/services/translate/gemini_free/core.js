import { nextPacificMidnight, sanitizeTtsFailureMessage } from '../../../utils/tts_fallback.js';
import { createCooldownStore } from '../../../utils/cooldown_store.js';

export const GEMINI_FREE_DEFAULT_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
];
export const GEMINI_FREE_SYSTEM_PROMPT = `You are a professional translation engine. Translate the user's text into the target language fluently and naturally, without a machine-translation style.
The text usually comes from a screenshot: it may be a fragment, contain OCR errors, or have broken line breaks. Translate it as it is; never complete, explain, or answer it.
Output only the translation, with no quotes, notes, or extra text.`;
export const GEMINI_FREE_USER_PROMPT = 'Translate into $to\n"""\n$text\n"""';
export const GEMINI_FREE_DEFAULT_CONFIG = {
    instanceName: 'Gemini Free API',
    apiKey: '',
    requestPath: 'https://generativelanguage.googleapis.com/v1beta',
    models: GEMINI_FREE_DEFAULT_MODELS,
    stream: true,
    thinking: 'lowest',
    systemPrompt: GEMINI_FREE_SYSTEM_PROMPT,
    userPrompt: GEMINI_FREE_USER_PROMPT,
};
const trim = (value) => (typeof value === 'string' ? value.trim() : '');
export function normalizeGeminiFreeConfig(config = {}) {
    const result = { ...GEMINI_FREE_DEFAULT_CONFIG, ...config };
    for (const key of ['instanceName', 'apiKey', 'requestPath', 'thinking', 'systemPrompt', 'userPrompt'])
        result[key] = trim(result[key]);
    const invalid = (key, message) => {
        const error = new Error(message);
        error.validationKey = key;
        throw error;
    };
    if (!result.apiKey) invalid('key_required', 'Gemini API Key is required.');
    const models = typeof result.models === 'string' ? result.models.split(/[,\r\n]+/) : result.models;
    result.models = [...new Set((Array.isArray(models) ? models : []).map(trim).filter(Boolean))];
    if (!result.models.length) invalid('models_required', 'At least one model is required.');
    if (!result.userPrompt.includes('$text')) invalid('text_required', 'User template must contain $text.');
    result.requestPath ||= GEMINI_FREE_DEFAULT_CONFIG.requestPath;
    if (!/^https?:\/\//i.test(result.requestPath)) result.requestPath = `https://${result.requestPath}`;
    result.requestPath = result.requestPath.replace(/\/+$/, '').replace(/\/models\/[^/]+$/, '');
    if (!['lowest', 'low', 'medium', 'high', 'default'].includes(result.thinking)) result.thinking = 'lowest';
    return result;
}
export function buildGeminiFreeRequest({
    config,
    model,
    text,
    from,
    to,
    detect,
    thinkingLevel = null,
    stream = config.stream,
}) {
    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: config.userPrompt.replace(/\$(text|from|to|detect)\b/g, (_, key) =>
                            String({ text, from, to, detect }[key] ?? '')
                        ),
                    },
                ],
            },
        ],
    };
    if (config.systemPrompt) body.systemInstruction = { parts: [{ text: config.systemPrompt }] };
    if (thinkingLevel !== null) body.generationConfig = { thinkingConfig: { thinkingLevel } };
    return {
        url: `${config.requestPath}/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
        headers: { 'x-goog-api-key': config.apiKey, 'Content-Type': 'application/json' },
        body,
    };
}
export function extractGeminiText(response) {
    const candidate = response?.candidates?.[0];
    return {
        text: (candidate?.content?.parts ?? [])
            .filter((p) => p.thought !== true && typeof p.text === 'string')
            .map((p) => p.text)
            .join(''),
        finishReason: candidate?.finishReason,
        blockReason: response?.promptFeedback?.blockReason,
    };
}
export function createGeminiSseParser() {
    let buffer = '';
    const parse = (lines) =>
        lines.filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5).trim()));
    return {
        push(chunk) {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            return parse(lines);
        },
        end() {
            const remainder = buffer;
            buffer = '';
            return parse([remainder]);
        },
    };
}
export function cleanGeminiText(text) {
    let value = String(text ?? '').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('“') && value.endsWith('”')))
        value = value.slice(1, -1).trim();
    return value;
}
export function createGeminiFreeCooldowns(options = {}) {
    return createCooldownStore({
        ...options,
        storageKey: 'pot_gemini_free_cooldowns',
        kinds: ['quota_daily', 'rate_limited', 'not_found'],
        resolveUntil: (failure, now) =>
            failure?.kind === 'quota_daily'
                ? failure.resetAt ?? nextPacificMidnight(now) + 60_000
                : failure?.kind === 'rate_limited'
                  ? now + Math.max(0, failure.retryAfterMs ?? 60_000)
                  : failure?.kind === 'not_found'
                    ? now + 86_400_000
                    : null,
    });
}
export function createGeminiJsonStore(storageKey, storage = () => globalThis.localStorage) {
    let memory = {};
    let available = true;
    const target = () => (typeof storage === 'function' ? storage() : storage);
    const read = () => {
        if (available)
            try {
                const value = JSON.parse(target().getItem(storageKey) ?? '{}');
                memory = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
            } catch {
                available = false;
            }
        return memory;
    };
    return {
        read,
        get: (key) => read()[key],
        set(key, value) {
            const values = { ...read(), [key]: value };
            memory = values;
            if (available)
                try {
                    target().setItem(storageKey, JSON.stringify(values));
                } catch {
                    available = false;
                }
        },
    };
}
export function createGeminiModelState(store, fingerprint, now = Date.now) {
    return {
        recordSuccess(model) {
            const key = `${fingerprint}|${model}`;
            store.set(key, { ...store.get(key), lastSuccessAt: now() });
        },
        recordFailure(model, kind) {
            const key = `${fingerprint}|${model}`;
            store.set(key, { ...store.get(key), lastFailureKind: kind, lastFailureAt: now() });
        },
    };
}
const STOP = ['auth', 'billing', 'region', 'network', 'blocked'];
export const stopsGeminiFree = (kind) => STOP.includes(kind);
export function geminiFreeError(kind, message, fields = {}) {
    const error = new Error(message);
    error.geminiFreeFailure = { kind, message, ...fields };
    return error;
}
export const GEMINI_FREE_ERROR_DEFAULTS = {
    auth: 'API Key is invalid or access is denied.',
    billing: 'Prepaid balance is exhausted.',
    region: 'Free tier is unavailable in this region.',
    network: 'Network request failed.',
    blocked: 'Content was blocked.',
    quota_daily: 'Daily quota exhausted; resets at {{time}}.',
    rate_limited: 'Rate limited; retry in about {{seconds}} seconds.',
    not_found: 'Model does not exist.',
    unavailable: 'Gemini is temporarily unavailable.',
    timeout: 'Request timed out.',
    invalid_request: 'Invalid request.',
    empty: 'No translation returned.',
    other: 'Request failed.',
    all_failed: 'All models failed.',
    partial: 'Partial translation has already been output.',
};
export function formatGeminiFreeError(failures, { stopped = false, t, now = Date.now() } = {}) {
    const translate = (key, values = {}) => {
        const defaultValue = GEMINI_FREE_ERROR_DEFAULTS[key] ?? GEMINI_FREE_ERROR_DEFAULTS.other;
        const translated = t?.(`services.translate.gemini_free.errors.${key}`, { defaultValue, ...values });
        return (translated || defaultValue).replace(/{{(\w+)}}/g, (_, name) => values[name] ?? '');
    };
    const lines = failures.map((failure) => {
        let reason;
        if (failure.kind === 'quota_daily') {
            const date = new Date(failure.cooldownUntil ?? failure.resetAt ?? nextPacificMidnight(now) + 60_000);
            const time = date.toLocaleString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                ...(date.toDateString() === new Date(now).toDateString() ? {} : { month: 'numeric', day: 'numeric' }),
            });
            reason = translate('quota_daily', { time });
        } else if (failure.kind === 'rate_limited')
            reason = translate('rate_limited', {
                seconds: Math.max(
                    1,
                    Math.ceil(((failure.cooldownUntil ?? now + (failure.retryAfterMs ?? 60_000)) - now) / 1000)
                ),
            });
        else
            reason =
                `${translate(failure.kind)} ${sanitizeTtsFailureMessage(failure.message, { apiKey: failure.apiKey }).slice(0, 300)}`.trim();
        return `${failure.model}: ${reason}`;
    });
    lines.push(translate(stopped ? failures.at(-1)?.kind : 'all_failed'));
    if (failures.at(-1)?.partial) lines.push(translate('partial'));
    return lines.join('\n');
}
export async function runGeminiFreeTranslate({
    models,
    thinking,
    callModel,
    cooldowns,
    thinkingMemory,
    modelState,
    keyFingerprint,
    shouldContinue = () => true,
    now = Date.now,
    t,
}) {
    const active = cooldowns.read();
    const available = models.filter(
        (model) => !active[`${keyFingerprint}|${model}`] || active[`${keyFingerprint}|${model}`].until <= now()
    );
    const failures = [];
    const check = () => {
        if (!shouldContinue()) {
            const error = new Error('Gemini translation cancelled');
            error.cancelled = true;
            throw error;
        }
    };
    const aggregate = (stopped) => {
        const error = new Error(formatGeminiFreeError(failures, { stopped, t, now: now() }));
        error.failures = failures;
        return error;
    };
    for (const model of available.length ? available : models) {
        check();
        let output = false;
        let level =
            thinking === 'default' ? null : thinking === 'lowest' ? thinkingMemory.get(model) ?? 'minimal' : thinking;
        const invoke = () =>
            callModel({
                model,
                thinkingLevel: level,
                onText: (value) => {
                    check();
                    if (value?.trim()) output = true;
                },
            });
        try {
            let result;
            try {
                result = await invoke();
            } catch (error) {
                check();
                if (
                    !output &&
                    thinking === 'lowest' &&
                    level === 'minimal' &&
                    error?.geminiFreeFailure?.kind === 'thinking_unsupported'
                ) {
                    thinkingMemory.set(model, 'low');
                    level = 'low';
                    check();
                    result = await invoke();
                } else throw error;
            }
            check();
            if (result.blockReason) throw geminiFreeError('blocked', result.blockReason);
            const text = cleanGeminiText(result.text);
            if (!text)
                throw geminiFreeError(
                    ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(result.finishReason)
                        ? 'blocked'
                        : 'empty',
                    result.finishReason ?? 'Empty response'
                );
            modelState.recordSuccess(model);
            return { text, model, failures };
        } catch (error) {
            check();
            const failure = {
                ...error?.geminiFreeFailure,
                model,
                message: error?.geminiFreeFailure?.message ?? String(error?.message ?? error),
                partial: output,
            };
            failure.kind ??= 'other';
            if (failure.limitZero && ['quota_daily', 'rate_limited'].includes(failure.kind))
                failure.kind = 'quota_daily';
            if (failure.kind === 'thinking_unsupported') failure.kind = 'invalid_request';
            modelState.recordFailure(model, failure.kind);
            if (!output) failure.cooldownUntil = cooldowns.record(`${keyFingerprint}|${model}`, failure);
            failures.push(failure);
            if (output || STOP.includes(failure.kind)) throw aggregate(true);
        }
    }
    throw aggregate(false);
}
