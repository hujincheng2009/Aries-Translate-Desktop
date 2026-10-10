import { BaseDirectory, readTextFile } from '@tauri-apps/api/fs';
import { listen } from '@tauri-apps/api/event';
import { sendNotification } from '@tauri-apps/api/notification';
import { invoke } from '@tauri-apps/api/tauri';
import Database from 'tauri-plugin-sql-api';
import { error as logError, info } from 'tauri-plugin-log-api';

import * as builtinServices from '../services/translate';
import { filterAvailableServices } from '../utils/service_availability';
import detect from '../utils/lang_detect';
import { invoke_plugin } from '../utils/invoke_plugin';
import {
    DEFAULT_TRANSLATE_SERVICE_LIST,
    normalizeReplacementSourceText,
    resolveReplacementTargetLanguage,
    selectDefaultEnabledService,
} from '../utils/replacement_translation';
import { getServiceName, whetherPluginService } from '../utils/service_instance';
import { store } from '../utils/store';

async function loadDefaultService() {
    const serviceInstanceList = (await store.get('translate_service_list')) ?? DEFAULT_TRANSLATE_SERVICE_LIST;
    const serviceInstanceConfigMap = {};

    for (const serviceInstanceKey of serviceInstanceList) {
        serviceInstanceConfigMap[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
    }

    const available = [];
    for (const key of serviceInstanceList) {
        if (whetherPluginService(key)) {
            try {
                await readTextFile(`plugins/translate/${getServiceName(key)}/info.json`, {
                    dir: BaseDirectory.AppConfig,
                });
                available.push(key);
            } catch {
                info(`Skipping unavailable translation service: ${key}`);
            }
        } else
            available.push(
                ...filterAvailableServices([key], builtinServices, {}, (key) =>
                    info(`Skipping unavailable translation service: ${key}`)
                )
            );
    }
    const serviceInstanceKey = selectDefaultEnabledService(available, serviceInstanceConfigMap);
    if (!serviceInstanceKey) {
        throw new Error('No enabled translation service');
    }

    return {
        serviceInstanceKey,
        config: serviceInstanceConfigMap[serviceInstanceKey],
    };
}

async function translateWithDefaultService(sourceText) {
    const { serviceInstanceKey, config } = await loadDefaultService();
    const serviceName = getServiceName(serviceInstanceKey);
    const sourceLanguage = (await store.get('translate_source_language')) ?? 'auto';
    const targetLanguage = (await store.get('translate_target_language')) ?? 'zh_cn';
    const secondLanguage = (await store.get('translate_second_language')) ?? 'en';
    const deleteNewline = (await store.get('translate_delete_newline')) ?? false;
    const text = normalizeReplacementSourceText(sourceText, deleteNewline);
    const detectedLanguage = await detect(text);
    const resolvedTargetLanguage = resolveReplacementTargetLanguage(
        sourceLanguage,
        targetLanguage,
        detectedLanguage,
        secondLanguage
    );

    let result;
    if (whetherPluginService(serviceInstanceKey)) {
        const pluginInfo = JSON.parse(
            await readTextFile(`plugins/translate/${serviceName}/info.json`, { dir: BaseDirectory.AppConfig })
        );
        if (!(sourceLanguage in pluginInfo.language) || !(resolvedTargetLanguage in pluginInfo.language)) {
            throw new Error('Language not supported');
        }
        const [func, utils] = await invoke_plugin('translate', serviceName);
        result = await func(text, pluginInfo.language[sourceLanguage], pluginInfo.language[resolvedTargetLanguage], {
            config: { ...config, enable: 'true' },
            detect: detectedLanguage,
            setResult: () => {},
            utils,
        });
    } else {
        const service = builtinServices[serviceName];
        if (!service) {
            throw new Error(`Translation service not found: ${serviceName}`);
        }
        if (!(sourceLanguage in service.Language) || !(resolvedTargetLanguage in service.Language)) {
            throw new Error('Language not supported');
        }
        result = await service.translate(
            text,
            service.Language[sourceLanguage],
            service.Language[resolvedTargetLanguage],
            {
                config,
                detect: detectedLanguage,
                setResult: () => {},
            }
        );
    }

    if (typeof result !== 'string' || result.trim() === '') {
        throw new Error('Translation service returned an empty or non-text result');
    }

    return {
        text,
        result: result.trim(),
        sourceLanguage: detectedLanguage,
        targetLanguage: resolvedTargetLanguage,
        serviceName,
        serviceInstanceKey,
    };
}

async function addToHistory(translation) {
    if ((await store.get('history_disable')) ?? false) return;

    const db = await Database.load('sqlite:history.db');
    try {
        await db.execute(
            'CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL,source TEXT NOT NULL,target TEXT NOT NULL,service TEXT NOT NULL, result TEXT NOT NULL,timestamp INTEGER NOT NULL)'
        );
        await db.execute(
            'INSERT into history (text, source, target, service, result, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
            [
                translation.text,
                translation.sourceLanguage,
                translation.targetLanguage,
                translation.serviceName,
                translation.result,
                Date.now(),
            ]
        );
    } finally {
        await db.close();
    }
}

async function notifyFailure(message) {
    const language = (await store.get('app_language')) ?? 'en';
    const title = language.startsWith('zh') ? 'Aries — 替换翻译失败' : 'Aries — Replace translation failed';
    await sendNotification({ title, body: message });
}

function isSupersededRequestError(message) {
    return message.includes('[stale replacement request]');
}

export async function startReplacementTranslationListener() {
    await listen('replace_translate_request', async (event) => {
        const { request_id: requestId, text } = event.payload;
        try {
            const translation = await translateWithDefaultService(text);
            await invoke('replace_selected_text', {
                requestId,
                sourceText: text,
                translatedText: translation.result,
            });
            void addToHistory(translation).catch((error) => logError(`Failed to write replacement history: ${error}`));
            info(`[${translation.serviceInstanceKey}] replacement translation completed`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await invoke('cancel_replace_translation', { requestId }).catch(() => {});
            if (isSupersededRequestError(message)) return;
            logError(`Replacement translation failed: ${message}`);
            await notifyFailure(message);
        }
    });
}
