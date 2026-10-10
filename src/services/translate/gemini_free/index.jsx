import { fetch as tauriFetch, Body } from '@tauri-apps/api/http';
import SHA256 from 'crypto-js/sha256';
import i18next from 'i18next';
import { Language } from './info';
import { classifyGeminiHttpError } from '../../../utils/gemini_error.js';
import { sanitizeTtsFailureMessage } from '../../../utils/tts_fallback.js';
import {
    normalizeGeminiFreeConfig,
    buildGeminiFreeRequest,
    extractGeminiText,
    createGeminiSseParser,
    createGeminiFreeCooldowns,
    createGeminiJsonStore,
    createGeminiModelState,
    runGeminiFreeTranslate,
    geminiFreeError,
    cleanGeminiText,
    formatGeminiFreeError,
} from './core.js';

export const geminiFreeCooldowns = createGeminiFreeCooldowns();
export const geminiFreeThinking = createGeminiJsonStore('pot_gemini_free_thinking');
export const geminiFreeModelStore = createGeminiJsonStore('pot_gemini_free_model_state');
export const geminiFreeFingerprint = (apiKey) => SHA256(apiKey.trim()).toString().slice(0, 12);
const safeError = (kind, message, config, fields = {}) =>
    geminiFreeError(
        kind,
        sanitizeTtsFailureMessage(String(message).split(config.apiKey).join('[REDACTED]'), { apiKey: config.apiKey }),
        fields
    );
const httpError = (status, data, config) => {
    const failure = classifyGeminiHttpError(status, data);
    return safeError(failure.kind, [failure.remoteStatus, failure.remoteMessage].filter(Boolean).join(': '), config, {
        retryAfterMs: failure.retryAfterMs,
        resetAt: failure.resetAt,
        limitZero: failure.limitZero,
    });
};
function createCallModel(config, { text, from, to, detect, setResult, shouldContinue = () => true }) {
    return async ({ model, thinkingLevel, onText }) => {
        const request = buildGeminiFreeRequest({ config, model, text, from, to, detect, thinkingLevel });
        if (!config.stream) {
            let response;
            try {
                response = await tauriFetch(request.url, {
                    method: 'POST',
                    headers: request.headers,
                    body: Body.json(request.body),
                    timeout: 30,
                });
            } catch (error) {
                throw safeError(
                    /timeout|timed out/i.test(String(error)) ? 'timeout' : 'network',
                    String(error),
                    config
                );
            }
            if (!response.ok) throw httpError(response.status, response.data, config);
            return extractGeminiText(response.data);
        }
        const controller = new AbortController();
        let timedOut = false;
        let timer;
        let reader;
        let completed = false;
        let stage = 'network';
        const arm = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, 30_000);
        };
        const check = () => {
            if (!shouldContinue()) {
                controller.abort();
                const error = new Error('Gemini translation cancelled');
                error.cancelled = true;
                throw error;
            }
        };
        arm();
        try {
            check();
            const response = await window.fetch(request.url, {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(request.body),
                signal: controller.signal,
            });
            if (!response.ok) throw httpError(response.status, await response.text(), config);
            stage = 'other';
            reader = response.body.getReader();
            const parser = createGeminiSseParser();
            const decoder = new TextDecoder();
            const result = { text: '', finishReason: undefined, blockReason: undefined };
            const consume = (events) => {
                for (const event of events) {
                    check();
                    if (event.error) throw httpError(event.error.code, event, config);
                    const delta = extractGeminiText(event);
                    result.finishReason = delta.finishReason ?? result.finishReason;
                    result.blockReason = delta.blockReason ?? result.blockReason;
                    if (delta.text) {
                        result.text += delta.text;
                        if (result.text.trim()) {
                            arm();
                            onText(result.text);
                            setResult?.(result.text + '_');
                        }
                    }
                }
            };
            while (true) {
                check();
                const { done, value } = await reader.read();
                check();
                if (done) {
                    consume(parser.push(decoder.decode()));
                    consume(parser.end());
                    completed = true;
                    return result;
                }
                consume(parser.push(decoder.decode(value, { stream: true })));
            }
        } catch (error) {
            if (error?.cancelled || error?.geminiFreeFailure) throw error;
            throw safeError(timedOut ? 'timeout' : stage, error?.message ?? String(error), config);
        } finally {
            clearTimeout(timer);
            if (!completed) {
                controller.abort();
                try {
                    await reader?.cancel();
                } catch {}
            }
            reader?.releaseLock();
        }
    };
}
export async function translate(text, from, to, { config, setResult, detect, shouldContinue = () => true }) {
    const normalized = normalizeGeminiFreeConfig(config);
    const fingerprint = geminiFreeFingerprint(normalized.apiKey);
    const result = await runGeminiFreeTranslate({
        models: normalized.models,
        thinking: normalized.thinking,
        callModel: createCallModel(normalized, {
            text,
            from,
            to,
            detect: Language[detect] ?? '',
            setResult,
            shouldContinue,
        }),
        cooldowns: geminiFreeCooldowns,
        thinkingMemory: geminiFreeThinking,
        modelState: createGeminiModelState(geminiFreeModelStore, fingerprint),
        keyFingerprint: fingerprint,
        shouldContinue,
        t: (key, options) => i18next.t(key, options) || options.defaultValue,
    });
    if (shouldContinue()) setResult?.(result.text);
    return result.text;
}
export async function testModel(config, model) {
    const normalized = normalizeGeminiFreeConfig({ ...config, models: [model], stream: false });
    const fingerprint = geminiFreeFingerprint(normalized.apiKey);
    const started = performance.now();
    const state = createGeminiModelState(geminiFreeModelStore, fingerprint);
    const call = createCallModel(normalized, { text: 'hello', from: Language.auto, to: Language.zh_cn });
    let thinkingLevel =
        normalized.thinking === 'default'
            ? null
            : normalized.thinking === 'lowest'
              ? geminiFreeThinking.get(model) ?? 'minimal'
              : normalized.thinking;
    try {
        let result;
        try {
            result = await call({ model, thinkingLevel });
        } catch (error) {
            if (
                normalized.thinking === 'lowest' &&
                thinkingLevel === 'minimal' &&
                error.geminiFreeFailure?.kind === 'thinking_unsupported'
            ) {
                geminiFreeThinking.set(model, 'low');
                result = await call({ model, thinkingLevel: 'low' });
            } else throw error;
        }
        if (result.blockReason) throw geminiFreeError('blocked', result.blockReason);
        const text = cleanGeminiText(result.text);
        if (!text)
            throw geminiFreeError(
                ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(result.finishReason)
                    ? 'blocked'
                    : 'empty',
                result.finishReason ?? 'Empty response'
            );
        state.recordSuccess(model);
        return { text, model, elapsedMs: Math.round(performance.now() - started) };
    } catch (error) {
        const failure = {
            ...error.geminiFreeFailure,
            model,
            message: error.geminiFreeFailure?.message ?? String(error.message ?? error),
        };
        failure.kind ??= 'other';
        if (failure.limitZero && ['quota_daily', 'rate_limited'].includes(failure.kind)) failure.kind = 'quota_daily';
        if (failure.kind === 'thinking_unsupported') failure.kind = 'invalid_request';
        state.recordFailure(model, failure.kind);
        failure.cooldownUntil = geminiFreeCooldowns.record(`${fingerprint}|${model}`, failure);
        const aggregate = new Error(
            formatGeminiFreeError([failure], {
                stopped: true,
                t: (key, options) => i18next.t(key, options) || options.defaultValue,
            })
        );
        aggregate.failures = [failure];
        throw aggregate;
    }
}
export * from './info';
export * from './Config';
