import { useTranslation } from 'react-i18next';
import React from 'react';

import { Switch } from '@/components/ui/switch';
import SettingsSection from '../../../../components/app/SettingsSection';
import SettingRow from '../../../../components/app/SettingRow';
import OptionSelect from '../../../../components/app/OptionSelect';
import { languageList } from '../../../../utils/language';
import { useConfig } from '../../../../hooks/useConfig';
import { invoke } from '@tauri-apps/api';
import { SELECTION_READ_ALOUD_CONFIG_KEY } from '../../../../utils/selection_read_aloud';

export default function Translate() {
    const [autoReadAloud, setAutoReadAloud] = useConfig('translate_auto_read_aloud', false);
    const [selectionReadAloud, setSelectionReadAloud] = useConfig(SELECTION_READ_ALOUD_CONFIG_KEY, true);
    const [sourceLanguage, setSourceLanguage] = useConfig('translate_source_language', 'auto');
    const [targetLanguage, setTargetLanguage] = useConfig('translate_target_language', 'zh_cn');
    const [secondLanguage, setSecondLanguage] = useConfig('translate_second_language', 'en');
    const [detectEngine, setDetectEngine] = useConfig('translate_detect_engine', 'baidu');
    const [followOcrLanguage, setFollowOcrLanguage] = useConfig('translate_follow_ocr_language', false);
    const [autoCopy, setAutoCopy] = useConfig('translate_auto_copy', 'disable');
    const [incrementalTranslate, setIncrementalTranslate] = useConfig('incremental_translate', false);
    const [historyDisable, setHistoryDisable] = useConfig('history_disable', false);
    const [dynamicTranslate, setDynamicTranslate] = useConfig('dynamic_translate', false);
    const [deleteNewline, setDeleteNewline] = useConfig('translate_delete_newline', false);
    const [rememberLanguage, setRememberLanguage] = useConfig('translate_remember_language', false);
    // const [translateFontSize, setTranslateFontSize] = useConfig('translate_font_size', 16);
    const [windowPosition, setWindowPosition] = useConfig('translate_window_position', 'mouse');
    const [rememberWindowSize, setRememberWindowSize] = useConfig('translate_remember_window_size', false);
    const [hideSource, setHideSource] = useConfig('hide_source', false);
    const [hideLanguage, setHideLanguage] = useConfig('hide_language', false);
    const [hideWindow, setHideWindow] = useConfig('translate_hide_window', false);
    const [closeOnBlur, setCloseOnBlur] = useConfig('translate_close_on_blur', true);
    const [alwaysOnTop, setAlwaysOnTop] = useConfig('translate_always_on_top', false);
    const { t } = useTranslation();

    const languageOptions = languageList.map((item) => ({ value: item, label: t(`languages.${item}`) }));
    const sourceLanguageOptions = [{ value: 'auto', label: t('languages.auto') }, ...languageOptions];
    const detectEngineOptions = ['baidu', 'tencent', 'niutrans', 'google', 'bing', 'yandex', 'local'].map((key) => ({
        value: key,
        label: t(`config.translate.${key}`),
    }));
    const autoCopyOptions = ['source', 'target', 'source_target', 'disable'].map((key) => ({
        value: key,
        label: t(`config.translate.${key}`),
    }));
    const windowPositionOptions = ['mouse', 'pre_state'].map((key) => ({
        value: key,
        label: t(`config.translate.${key}`),
    }));

    return (
        <>
            <SettingsSection
                title={t('config.translate.section.language')}
                description={t('config.translate.section.language_desc')}
            >
                <SettingRow title={t('config.translate.source_language')}>
                    {sourceLanguage !== null && (
                        <OptionSelect
                            ariaLabel={t('config.translate.source_language')}
                            value={sourceLanguage}
                            label={t(`languages.${sourceLanguage}`)}
                            options={sourceLanguageOptions}
                            onChange={setSourceLanguage}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.target_language')}>
                    {targetLanguage !== null && (
                        <OptionSelect
                            ariaLabel={t('config.translate.target_language')}
                            value={targetLanguage}
                            label={t(`languages.${targetLanguage}`)}
                            options={languageOptions}
                            onChange={setTargetLanguage}
                        />
                    )}
                </SettingRow>
                <SettingRow
                    title={t('config.translate.second_language')}
                    description={t('config.translate.second_language_desc')}
                >
                    {secondLanguage !== null && (
                        <OptionSelect
                            ariaLabel={t('config.translate.second_language')}
                            value={secondLanguage}
                            label={t(`languages.${secondLanguage}`)}
                            options={languageOptions}
                            onChange={setSecondLanguage}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.detect_engine')}>
                    {detectEngine !== null && (
                        <OptionSelect
                            ariaLabel={t('config.translate.detect_engine')}
                            value={detectEngine}
                            label={t(`config.translate.${detectEngine}`)}
                            options={detectEngineOptions}
                            onChange={setDetectEngine}
                        />
                    )}
                </SettingRow>
            </SettingsSection>

            <SettingsSection title={t('config.translate.section.behavior')}>
                <SettingRow
                    title={t('config.translate.auto_read_aloud')}
                    description={t('config.translate.auto_read_aloud_description')}
                >
                    <Switch
                        checked={autoReadAloud === true}
                        onCheckedChange={setAutoReadAloud}
                    />
                </SettingRow>
                <SettingRow
                    title={t('config.translate.selection_read_aloud')}
                    description={t('config.translate.selection_read_aloud_description')}
                >
                    <Switch
                        checked={selectionReadAloud !== false}
                        onCheckedChange={setSelectionReadAloud}
                    />
                </SettingRow>
                <SettingRow
                    title={t('config.translate.follow_ocr_language', 'Follow specified OCR language')}
                    description={t(
                        'config.translate.follow_ocr_language_hint',
                        'Use the specified OCR language when the translation source is automatic. Automatic OCR and incremental translation still use detection.'
                    )}
                >
                    <Switch
                        checked={followOcrLanguage === true}
                        onCheckedChange={setFollowOcrLanguage}
                    />
                </SettingRow>
                <SettingRow title={t('config.translate.auto_copy')}>
                    {autoCopy !== null && (
                        <OptionSelect
                            ariaLabel={t('config.translate.auto_copy')}
                            value={autoCopy}
                            label={t(`config.translate.${autoCopy}`)}
                            options={autoCopyOptions}
                            onChange={(key) => {
                                setAutoCopy(key);
                                invoke('update_tray', { language: '', copyMode: key });
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.history_disable')}>
                    {historyDisable !== null && (
                        <Switch
                            checked={historyDisable}
                            onCheckedChange={(v) => {
                                setHistoryDisable(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.incremental_translate')}>
                    {incrementalTranslate !== null && (
                        <Switch
                            checked={incrementalTranslate}
                            onCheckedChange={(v) => {
                                setIncrementalTranslate(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.dynamic_translate')}>
                    {dynamicTranslate !== null && (
                        <Switch
                            checked={dynamicTranslate}
                            onCheckedChange={(v) => {
                                setDynamicTranslate(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.delete_newline')}>
                    {deleteNewline !== null && (
                        <Switch
                            checked={deleteNewline}
                            onCheckedChange={(v) => {
                                setDeleteNewline(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.remember_language')}>
                    {rememberLanguage !== null && (
                        <Switch
                            checked={rememberLanguage}
                            onCheckedChange={(v) => {
                                setRememberLanguage(v);
                            }}
                        />
                    )}
                </SettingRow>
            </SettingsSection>

            <SettingsSection title={t('config.translate.section.window')}>
                <SettingRow title={t('config.translate.window_position')}>
                    {windowPosition !== null && (
                        <OptionSelect
                            ariaLabel={t('config.translate.window_position')}
                            value={windowPosition}
                            label={t(`config.translate.${windowPosition}`)}
                            options={windowPositionOptions}
                            onChange={setWindowPosition}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.remember_window_size')}>
                    {rememberWindowSize !== null && (
                        <Switch
                            checked={rememberWindowSize}
                            onCheckedChange={(v) => {
                                setRememberWindowSize(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.close_on_blur')}>
                    {closeOnBlur !== null && (
                        <Switch
                            checked={closeOnBlur}
                            onCheckedChange={(v) => {
                                setCloseOnBlur(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.always_on_top')}>
                    {alwaysOnTop !== null && (
                        <Switch
                            checked={alwaysOnTop}
                            onCheckedChange={(v) => {
                                setAlwaysOnTop(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.hide_source')}>
                    {hideSource !== null && (
                        <Switch
                            checked={hideSource}
                            onCheckedChange={(v) => {
                                setHideSource(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.hide_language')}>
                    {hideLanguage !== null && (
                        <Switch
                            checked={hideLanguage}
                            onCheckedChange={(v) => {
                                setHideLanguage(v);
                            }}
                        />
                    )}
                </SettingRow>
                <SettingRow title={t('config.translate.hide_window')}>
                    {hideWindow !== null && (
                        <Switch
                            checked={hideWindow}
                            onCheckedChange={(v) => {
                                setHideWindow(v);
                            }}
                        />
                    )}
                </SettingRow>
            </SettingsSection>
        </>
    );
}
