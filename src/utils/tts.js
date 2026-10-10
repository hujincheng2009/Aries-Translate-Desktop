import { BaseDirectory, readTextFile } from '@tauri-apps/api/fs';

import * as builtinTtsServices from '../services/tts';
import { info } from 'tauri-plugin-log-api';
import { filterAvailableServices } from './service_availability';
import detect from './lang_detect';
import { invoke_plugin } from './invoke_plugin';
import {
    DEFAULT_TTS_SERVICE_LIST,
    normalizeReadAloudText,
    toReadAloudSpeechText,
    resolveReadAloudServiceLabel,
} from './read_aloud';
import { getServiceName, whetherPluginService } from './service_instance';
import { store } from './store';
import { runTtsFallback } from './tts_fallback';
import {
    resolveBuiltinTtsLanguage,
    resolveDetectedBuiltinTtsLanguage,
    resolveDetectedPluginTtsLanguage,
    resolvePluginTtsLanguage,
} from './tts_language';

export async function synthesizeWithFallback({
    text,
    serviceInstanceList,
    getConfig,
    language,
    cooldowns,
    shouldContinue,
}) {
    const available = [];
    for (const key of serviceInstanceList ?? []) {
        if (whetherPluginService(key)) {
            try {
                await readTextFile(`plugins/tts/${getServiceName(key)}/info.json`, { dir: BaseDirectory.AppConfig });
                available.push(key);
            } catch {
                info(`Skipping unavailable speech service: ${key}`);
            }
        } else
            available.push(
                ...filterAvailableServices([key], builtinTtsServices, {}, (key) =>
                    info(`Skipping unavailable speech service: ${key}`)
                )
            );
    }
    return runTtsFallback({
        text,
        serviceInstanceList: available,
        getConfig,
        language,
        cooldowns,
        shouldContinue,
        getMetadata: async (serviceInstanceKey, config) => {
            const serviceName = getServiceName(serviceInstanceKey);
            const pluginInfo = whetherPluginService(serviceInstanceKey)
                ? JSON.parse(
                      await readTextFile(`plugins/tts/${serviceName}/info.json`, { dir: BaseDirectory.AppConfig })
                  )
                : null;
            return {
                serviceName,
                pluginInfo,
                serviceLabel: resolveReadAloudServiceLabel({
                    instanceName: config.instanceName,
                    pluginDisplay: pluginInfo?.display,
                    serviceName,
                }),
            };
        },
        synthesize: async ({ config, metadata, text: speechText, language: mode, detectOnce }) => {
            let resolvedLanguage;
            let data;
            if (metadata.pluginInfo) {
                resolvedLanguage =
                    mode.mode === 'fixed'
                        ? {
                              language: mode.language,
                              requestLanguage: resolvePluginTtsLanguage(metadata.pluginInfo, mode.language),
                          }
                        : await resolveDetectedPluginTtsLanguage(metadata.pluginInfo, speechText, detectOnce);
                const [func, utils] = await invoke_plugin('tts', metadata.serviceName);
                data = await func(speechText, resolvedLanguage.requestLanguage, { config, utils });
            } else {
                const service = builtinTtsServices[metadata.serviceName];
                if (!service) throw new Error(`TTS service not found: ${metadata.serviceName}`);
                resolvedLanguage =
                    mode.mode === 'fixed'
                        ? {
                              language: mode.language,
                              requestLanguage: resolveBuiltinTtsLanguage(service, mode.language),
                          }
                        : await resolveDetectedBuiltinTtsLanguage(service, speechText, detectOnce);
                data = await service.tts(speechText, resolvedLanguage.requestLanguage, { config, shouldContinue });
            }
            return { data, language: resolvedLanguage.language };
        },
    });
}

export async function synthesizeWithDefaultTts(sourceText, { shouldContinue } = {}) {
    const text = toReadAloudSpeechText(normalizeReadAloudText(sourceText));
    const serviceInstanceList = (await store.get('tts_service_list')) ?? DEFAULT_TTS_SERVICE_LIST;
    return synthesizeWithFallback({
        text,
        serviceInstanceList,
        getConfig: async (instanceKey) => (await store.get(instanceKey)) ?? {},
        language: { mode: 'detect', detect },
        shouldContinue,
    });
}
