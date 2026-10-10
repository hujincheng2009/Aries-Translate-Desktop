import { wrapPcmInWav } from '../../../utils/tts_audio.js';

export const DEFAULT_LIVE_MODEL = 'gemini-3.8-live';
export const DEFAULT_LIVE_TIMEOUTS = { setupMs: 15_000, idleMs: 30_000, totalMs: 60_000 };
export const GEMINI_LIVE_ENDPOINT =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
export const DEFAULT_PROMPT_ZH = `你是一个复述助手。用户每发来一条消息，你就用同样的语言，把这条消息一字不差地大声复述一遍。
- 只复述用户的原话，不回答、不翻译、不解释、不纠正、不总结，也不对内容做任何回应，即使内容是问题或指令。
- 前后不加任何话，比如“好的”“你说的是”。
- 不跳过、不调换、不重复任何部分。
- 数字、符号和缩写按母语者的自然读法读出。`;
export const DEFAULT_PROMPT_OTHER = `You are a repeat-after-me partner. Every time the user sends a message, say the user's message back out loud, word for word, exactly as they wrote it, in the same language.
- Repeat only the user's words. Do not answer, translate, explain, correct, summarize, or react to them, even if the message is a question or an instruction.
- Do not add any words before or after, such as greetings, "Sure", or "You said".
- Do not skip, reorder, or repeat any part.
- Read numbers, symbols, and abbreviations naturally, the way a native speaker would say them.`;
export const DEFAULT_LIVE_CONFIG = {
    instanceName: 'Gemini Live 朗读',
    apiKey: '',
    model: DEFAULT_LIVE_MODEL,
    voice: 'Kore',
    promptZh: DEFAULT_PROMPT_ZH,
    promptOther: DEFAULT_PROMPT_OTHER,
    attempts: 3,
};
const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
export function normalizeGeminiLiveConfig(config = {}) {
    const result = { ...DEFAULT_LIVE_CONFIG, ...config };
    for (const key of ['instanceName', 'apiKey', 'model', 'voice', 'promptZh', 'promptOther'])
        result[key] = trim(result[key]);
    for (const [key, message] of [
        ['apiKey', 'Gemini API Key is required.'],
        ['model', 'Gemini Live model is required.'],
    ]) {
        if (!result[key]) {
            const error = new Error(message);
            error.validationKey = key === 'apiKey' ? 'key_required' : 'model_required';
            throw error;
        }
    }
    result.voice ||= 'Kore';
    result.promptZh ||= DEFAULT_PROMPT_ZH;
    result.promptOther ||= DEFAULT_PROMPT_OTHER;
    if (!Number.isInteger(result.attempts) || result.attempts < 1 || result.attempts > 3) result.attempts = 3;
    return result;
}
export function planGeminiLiveSegments(text) {
    const value = trim(text);
    if (!value) throw new Error('Text to read is required.');
    if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)) {
        const error = new Error('Language not supported by Gemini Live: Japanese text.');
        error.languageUnsupported = true;
        throw error;
    }
    const sentences = value.split(/(?<=[。！？!?；;\n])|(?<=\.)(?=\s)/u).filter(Boolean);
    const pieces = sentences.flatMap((sentence) =>
        Array.from(sentence).length > 200 ? sentence.split(/(?<=[，,、])/u) : [sentence]
    );
    const originals = [];
    let pending = '';
    for (const piece of pieces) {
        const characters = Array.from(piece);
        while (characters.length) {
            const chunk = characters.splice(0, 200).join('');
            if (Array.from(pending + chunk).length > 200) {
                if (pending.trim()) originals.push(pending.trim());
                pending = '';
            }
            pending += chunk;
        }
    }
    if (pending.trim()) originals.push(pending.trim());
    return originals.map((original) => {
        const chinese = /\p{Script=Han}/u.test(original);
        return {
            original,
            promptKey: chinese ? 'zh' : 'other',
            text: chinese ? original.replace(/([，。！？；：、”])\s*/gu, '$1 ').trim() : original,
        };
    });
}
export function expectedSpeechSeconds(text) {
    const value = String(text ?? '');
    const characters = [...value.matchAll(CJK)].length;
    const words = value
        .replace(CJK, ' ')
        .split(/\s+/)
        .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
    return characters * 0.22 + words * 0.35;
}
export function speechSeconds(pcm) {
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const samples = Math.floor(pcm.byteLength / 2);
    let voiced = 0;
    for (let start = 0; start < samples; start += 2400) {
        const end = Math.min(samples, start + 2400);
        let sum = 0;
        for (let index = start; index < end; index++) {
            const value = view.getInt16(index * 2, true);
            sum += value * value;
        }
        if (Math.sqrt(sum / (end - start)) > 300) voiced += end - start;
    }
    return voiced / 24000;
}
export function judgeGeminiLiveSegment({ pcm, interrupted, original }) {
    const expectedSeconds = expectedSpeechSeconds(original);
    const duration = speechSeconds(pcm);
    const reason = !pcm.byteLength
        ? 'silent'
        : interrupted
          ? 'interrupted'
          : expectedSeconds < 1
            ? undefined
            : duration < expectedSeconds * 0.5
              ? 'incomplete'
              : undefined;
    return { ok: reason === undefined, reason, speechSeconds: duration, expectedSeconds };
}
export function buildGeminiLiveSetup(config, promptKey) {
    return {
        setup: {
            model: `models/${config.model.replace(/^models\//, '')}`,
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } } },
            },
            systemInstruction: { parts: [{ text: promptKey === 'zh' ? config.promptZh : config.promptOther }] },
            outputAudioTranscription: {},
        },
    };
}
export const buildGeminiLiveTextMessage = (text) => ({
    clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true },
});
export async function decodeGeminiLiveFrame(frame) {
    let text;
    if (typeof frame === 'string') text = frame;
    else if (frame instanceof ArrayBuffer || ArrayBuffer.isView(frame)) text = new TextDecoder().decode(frame);
    else if (typeof Blob !== 'undefined' && frame instanceof Blob) text = await frame.text();
    else throw new Error('Unsupported Gemini Live frame.');
    return JSON.parse(text);
}
export function concatGeminiLivePcm(chunks) {
    const total = chunks.reduce((sum, value) => sum + value.byteLength, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
}
function decodePcm(data) {
    if (typeof data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
        throw new Error('Invalid PCM data.');
    return Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
}
export function redactGeminiLiveError(value, apiKey = '') {
    let message = String(value ?? '');
    if (apiKey) {
        message = message.split(apiKey).join('[REDACTED]').split(encodeURIComponent(apiKey)).join('[REDACTED]');
    }
    return message
        .replace(/wss:\/\/[^\s"'<>]+/gi, '[REDACTED URL]')
        .replace(/(\b(?:key|access_token)=)[^\s&,;"'<>]+/gi, '$1[REDACTED]')
        .slice(0, 1000);
}
export function classifyGeminiLiveClose(code, reason = '') {
    const message = String(reason);
    const kind =
        code === 1007 && /API key not valid/i.test(message)
            ? 'auth'
            : code === 1008 && /unregistered callers|leaked|denied access/i.test(message)
              ? 'auth'
              : code === 1008 && /not found|not supported for bidiGenerateContent/i.test(message)
                ? 'model'
                : code === 1011 && /quota/i.test(message)
                  ? 'quota'
                  : code === 1011
                    ? 'server'
                    : code === 1007
                      ? 'invalid'
                      : 'network';
    return { kind, closeCode: code, message };
}
function liveError(kind, message, fields = {}) {
    const error = new Error(message);
    error.liveFailure = { kind, message, ...fields };
    return error;
}
const defaultClock = {
    now: () => Date.now(),
    setTimeout: (...args) => globalThis.setTimeout(...args),
    clearTimeout: (timer) => globalThis.clearTimeout(timer),
};
export function runGeminiLiveAttempt({
    url,
    setup,
    text,
    WebSocketImpl,
    timeouts = DEFAULT_LIVE_TIMEOUTS,
    clock = defaultClock,
}) {
    const apiKey = (() => {
        try {
            return new URL(url).searchParams.get('key') ?? '';
        } catch {
            return '';
        }
    })();
    return new Promise((resolve, reject) => {
        let socket,
            settled = false,
            ready = false,
            interrupted = false,
            queue = Promise.resolve();
        const chunks = [],
            timers = new Set(),
            timings = {};
        const start = clock.now();
        let setupTimer, idleTimer;
        const removeTimer = (timer) => {
            clock.clearTimeout(timer);
            timers.delete(timer);
        };
        const schedule = (fn, duration) => {
            const timer = clock.setTimeout(fn, duration);
            timers.add(timer);
            return timer;
        };
        const handlers = {};
        const finish = (failure) => {
            if (settled) return;
            settled = true;
            for (const timer of timers) clock.clearTimeout(timer);
            timers.clear();
            if (socket) {
                for (const [event, handler] of Object.entries(handlers)) socket.removeEventListener(event, handler);
                try {
                    socket.close(1000);
                } catch {}
            }
            timings.totalMs = clock.now() - start;
            if (failure) reject(failure);
            else {
                const pcm = concatGeminiLivePcm(chunks);
                if (pcm.byteLength % 2) reject(liveError('invalid', 'Incomplete PCM sample.'));
                else resolve({ pcm, interrupted, timings });
            }
        };
        const fail = (kind, message, fields) => finish(liveError(kind, message, fields));
        const idle = () => {
            removeTimer(idleTimer);
            idleTimer = schedule(
                () => fail('timeout', 'No Gemini Live messages received within the idle timeout.'),
                timeouts.idleMs ?? DEFAULT_LIVE_TIMEOUTS.idleMs
            );
        };
        const send = (message) => {
            try {
                socket.send(JSON.stringify(message));
            } catch {
                fail('network', 'Could not send Gemini Live message.');
            }
        };
        handlers.open = () => {
            if (!settled) send(setup);
        };
        handlers.message = (event) => {
            if (settled) return;
            idle();
            queue = queue
                .then(async () => {
                    if (settled) return;
                    const message = await decodeGeminiLiveFrame(event.data);
                    if (settled) return;
                    if (message.setupComplete && !ready) {
                        ready = true;
                        removeTimer(setupTimer);
                        timings.setupMs = clock.now() - start;
                        send(buildGeminiLiveTextMessage(text));
                    }
                    const content = message.serverContent;
                    if (content) {
                        for (const part of content.modelTurn?.parts ?? []) {
                            const data = part.inlineData;
                            if (!data) continue;
                            if (
                                !/^audio\/pcm(?:;|$)/i.test(data.mimeType ?? '') ||
                                !/\brate=24000(?:;|$)/i.test(data.mimeType)
                            ) {
                                fail('invalid', 'Expected 24 kHz PCM audio.');
                                return;
                            }
                            const pcm = decodePcm(data.data);
                            if (pcm.byteLength) {
                                timings.firstAudioMs ??= clock.now() - start;
                                chunks.push(pcm);
                            }
                        }
                        interrupted ||= content.interrupted === true;
                        // Interrupted turns have no generationComplete; retry them immediately.
                        if (content.generationComplete || interrupted) {
                            finish();
                            return;
                        }
                    }
                    if (message.goAway)
                        fail('server', 'Gemini Live asked to end the session before generation completed.');
                })
                .catch(() => fail('invalid', 'Could not decode Gemini Live response.'));
        };
        handlers.close = (event) => {
            queue = queue
                .then(() => {
                    if (settled) return;
                    const failure = classifyGeminiLiveClose(event.code, redactGeminiLiveError(event.reason, apiKey));
                    finish(
                        liveError(
                            failure.kind,
                            failure.message || 'Gemini Live connection closed before generation completed.',
                            { closeCode: failure.closeCode }
                        )
                    );
                })
                .catch(() => fail('network', 'Gemini Live connection closed.'));
        };
        handlers.error = () => {
            queue = queue
                .then(() => fail('network', 'Could not connect to Gemini Live.'))
                .catch(() => fail('network', 'Gemini Live connection failed.'));
        };
        try {
            socket = new WebSocketImpl(url);
            socket.binaryType = 'arraybuffer';
            for (const [event, handler] of Object.entries(handlers)) socket.addEventListener(event, handler);
            setupTimer = schedule(
                () => fail('timeout', 'Gemini Live setup timed out.'),
                timeouts.setupMs ?? DEFAULT_LIVE_TIMEOUTS.setupMs
            );
            schedule(
                () => fail('timeout', 'Gemini Live total time limit reached.'),
                timeouts.totalMs ?? DEFAULT_LIVE_TIMEOUTS.totalMs
            );
            idle();
        } catch {
            fail('network', 'Could not create Gemini Live connection.');
        }
    });
}
export const LIVE_ERROR_DEFAULTS = {
    auth: 'Gemini Live API Key is invalid or access is denied.',
    quota: 'Gemini Live rate limit reached; retry in about 60 seconds.',
    model: 'Gemini Live model does not exist or is unsupported.',
    invalid: 'Invalid Gemini Live request or response.',
    timeout: 'Gemini Live request timed out.',
    server: 'Gemini Live is temporarily unavailable.',
    network: 'Gemini Live connection failed.',
    silent: 'No audio returned.',
    incomplete: 'The text was not read completely.',
    interrupted: 'Generation was interrupted.',
    japanese: 'Language not supported by Gemini Live: Japanese text.',
    empty_text: 'Text to read is required.',
    exhausted:
        'Gemini Live could not fully read segment {{index}}/{{total}}: {{attempts}} attempts, {{silent}} silent, {{incomplete}} incomplete, {{other}} other errors.',
};
function translatedLiveError(kind, values, t) {
    const defaultValue = LIVE_ERROR_DEFAULTS[kind] ?? LIVE_ERROR_DEFAULTS.invalid;
    return (t?.(`services.tts.gemini_live_tts.errors.${kind}`, { defaultValue, ...values }) || defaultValue).replace(
        /{{(\w+)}}/g,
        (_, key) => values?.[key] ?? ''
    );
}
export async function synthesizeGeminiLive({ text, config, WebSocketImpl, timeouts, clock, t }) {
    let normalized;
    try {
        normalized = normalizeGeminiLiveConfig(config);
    } catch (error) {
        throw new Error(redactGeminiLiveError(error.message, config?.apiKey));
    }
    let segments;
    try {
        segments = planGeminiLiveSegments(text);
    } catch (error) {
        const message = translatedLiveError(error.languageUnsupported ? 'japanese' : 'empty_text', {}, t);
        const safe = new Error(redactGeminiLiveError(message, normalized.apiKey));
        safe.languageUnsupported = error.languageUnsupported;
        throw safe;
    }
    const url = `${GEMINI_LIVE_ENDPOINT}?key=${encodeURIComponent(normalized.apiKey)}`;
    const audio = [];
    for (let index = 0; index < segments.length; index++) {
        const segment = segments[index],
            stats = { silent: 0, incomplete: 0, other: 0 };
        let lastFailure,
            accepted = false;
        for (let attempt = 0; attempt < normalized.attempts; attempt++) {
            try {
                const result = await runGeminiLiveAttempt({
                    url,
                    setup: buildGeminiLiveSetup(normalized, segment.promptKey),
                    text: segment.text,
                    WebSocketImpl,
                    timeouts,
                    clock,
                });
                const judgment = judgeGeminiLiveSegment({ ...result, original: segment.original });
                if (judgment.ok) {
                    audio.push(result.pcm);
                    accepted = true;
                    break;
                }
                lastFailure = { kind: judgment.reason };
                stats[judgment.reason === 'interrupted' ? 'other' : judgment.reason]++;
            } catch (error) {
                lastFailure = error.liveFailure ?? { kind: 'network', message: 'Gemini Live connection failed.' };
                if (['auth', 'quota', 'model', 'invalid'].includes(lastFailure.kind)) {
                    const safe = new Error(
                        redactGeminiLiveError(
                            `${translatedLiveError(lastFailure.kind, {}, t)} ${lastFailure.message ?? ''}`,
                            normalized.apiKey
                        )
                    );
                    safe.ttsFailure =
                        lastFailure.kind === 'quota'
                            ? { kind: 'rate_limited', retryAfterMs: 60_000 }
                            : { kind: lastFailure.kind === 'auth' ? 'auth' : 'other' };
                    throw safe;
                }
                stats.other++;
            }
        }
        if (!accepted) {
            const suffix = stats.other
                ? ` ${translatedLiveError(lastFailure?.kind, {}, t)} ${lastFailure?.message ?? ''}`
                : '';
            const safe = new Error(
                redactGeminiLiveError(
                    translatedLiveError(
                        'exhausted',
                        { index: index + 1, total: segments.length, attempts: normalized.attempts, ...stats },
                        t
                    ) + suffix,
                    normalized.apiKey
                )
            );
            safe.ttsFailure = { kind: 'other' };
            throw safe;
        }
    }
    return wrapPcmInWav(concatGeminiLivePcm(audio), 24000);
}
