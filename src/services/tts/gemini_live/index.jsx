import i18next from 'i18next';
import { synthesizeGeminiLive, normalizeGeminiLiveConfig } from './core.js';

export const validateGeminiLiveConfig = (config) => normalizeGeminiLiveConfig(config);
export function tts(text, _language, { config } = {}) {
    return synthesizeGeminiLive({
        text,
        config,
        WebSocketImpl: window.WebSocket,
        t: (key, options) => i18next.t(key, options),
    });
}
export * from './info';
export * from './Config';
