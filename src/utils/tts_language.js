const AUTOMATIC_LANGUAGE = 'auto';

export function resolveBuiltinTtsLanguage(service, language) {
    const languageMap = service?.Language ?? {};
    if (service?.info?.languageMode === AUTOMATIC_LANGUAGE) {
        if (!Object.prototype.hasOwnProperty.call(languageMap, AUTOMATIC_LANGUAGE)) {
            throw new Error('Automatic TTS service must define Language.auto');
        }
        return languageMap[AUTOMATIC_LANGUAGE];
    }

    if (language === AUTOMATIC_LANGUAGE || !Object.prototype.hasOwnProperty.call(languageMap, language)) {
        throw new Error('Language not supported');
    }
    return languageMap[language];
}

export async function resolveDetectedBuiltinTtsLanguage(service, text, detectLanguage) {
    if (service?.info?.languageMode === AUTOMATIC_LANGUAGE) {
        return {
            language: AUTOMATIC_LANGUAGE,
            requestLanguage: resolveBuiltinTtsLanguage(service, AUTOMATIC_LANGUAGE),
        };
    }

    const language = await detectLanguage(text);
    return {
        language,
        requestLanguage: resolveBuiltinTtsLanguage(service, language),
    };
}

function getAutomaticPluginLanguage(pluginInfo) {
    const languageMap = pluginInfo?.language ?? {};
    return Object.prototype.hasOwnProperty.call(languageMap, AUTOMATIC_LANGUAGE)
        ? languageMap[AUTOMATIC_LANGUAGE]
        : null;
}

export function resolvePluginTtsLanguage(pluginInfo, language) {
    const automaticLanguage = getAutomaticPluginLanguage(pluginInfo);
    if (automaticLanguage !== null) return automaticLanguage;

    if (!(language in pluginInfo.language)) throw new Error('Language not supported');
    return pluginInfo.language[language];
}

export async function resolveDetectedPluginTtsLanguage(pluginInfo, text, detectLanguage) {
    const automaticLanguage = getAutomaticPluginLanguage(pluginInfo);
    if (automaticLanguage !== null) {
        return {
            language: AUTOMATIC_LANGUAGE,
            requestLanguage: automaticLanguage,
        };
    }

    const language = await detectLanguage(text);
    return {
        language,
        requestLanguage: resolvePluginTtsLanguage(pluginInfo, language),
    };
}
