import { useTranslation } from 'react-i18next';
import React from 'react';

import { Switch } from '@/components/ui/switch';
import SettingsSection from '../../../../components/app/SettingsSection';
import SettingRow from '../../../../components/app/SettingRow';
import OptionSelect from '../../../../components/app/OptionSelect';
import { languageList } from '../../../../utils/language';
import { useConfig } from '../../../../hooks';

export default function Recognize() {
    const [recognizeLanguage, setRecognizeLanguage] = useConfig('recognize_language', 'auto');
    const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline', false);
    const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy', false);
    const [hideWindow, setHideWindow] = useConfig('recognize_hide_window', false);
    const [closeOnBlur, setCloseOnBlur] = useConfig('recognize_close_on_blur', false);
    const { t } = useTranslation();

    const languageOptions = [
        { value: 'auto', label: t('languages.auto') },
        ...languageList.map((item) => ({ value: item, label: t(`languages.${item}`) })),
    ];

    return (
        <SettingsSection
            title={t('config.recognize.section.title')}
            description={t('config.recognize.section.description')}
        >
            <SettingRow title={t('config.recognize.language')}>
                {recognizeLanguage !== null && (
                    <OptionSelect
                        ariaLabel={t('config.recognize.language')}
                        value={recognizeLanguage}
                        label={t(`languages.${recognizeLanguage}`)}
                        options={languageOptions}
                        onChange={setRecognizeLanguage}
                    />
                )}
            </SettingRow>
            <SettingRow title={t('config.recognize.delete_newline')}>
                {deleteNewline !== null && (
                    <Switch
                        checked={deleteNewline}
                        onCheckedChange={(v) => {
                            setDeleteNewline(v);
                        }}
                    />
                )}
            </SettingRow>
            <SettingRow
                title={t('config.recognize.auto_copy')}
                description={t('config.recognize.auto_copy_desc')}
            >
                {autoCopy !== null && (
                    <Switch
                        checked={autoCopy}
                        onCheckedChange={(v) => {
                            setAutoCopy(v);
                        }}
                    />
                )}
            </SettingRow>
            <SettingRow title={t('config.recognize.close_on_blur')}>
                {closeOnBlur !== null && (
                    <Switch
                        checked={closeOnBlur}
                        onCheckedChange={(v) => {
                            setCloseOnBlur(v);
                        }}
                    />
                )}
            </SettingRow>
            <SettingRow
                title={t('config.recognize.hide_window')}
                description={t('config.recognize.hide_window_desc')}
            >
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
    );
}
