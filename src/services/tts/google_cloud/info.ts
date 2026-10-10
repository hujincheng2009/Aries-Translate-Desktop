import { GOOGLE_CLOUD_TTS_LANGUAGE_CODES, GOOGLE_CLOUD_TTS_VOICE_OPTIONS } from './core';

export const info = {
    name: 'google_cloud_tts',
    icon: 'logo/google-2025.webp',
};

export const Language = Object.freeze(
    Object.fromEntries(Object.keys(GOOGLE_CLOUD_TTS_LANGUAGE_CODES).map((language) => [language, language]))
);

export const VoiceOptions = GOOGLE_CLOUD_TTS_VOICE_OPTIONS;
