import { unregister, isRegistered } from '@tauri-apps/api/globalShortcut';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { Switch } from '@/components/ui/switch';
import HotkeyRecorder from '../../../../components/app/HotkeyRecorder';
import SettingsSection from '../../../../components/app/SettingsSection';
import SettingRow from '../../../../components/app/SettingRow';
import { useConfig } from '../../../../hooks/useConfig';
import { useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';
import { invoke } from '@tauri-apps/api';

const keyMap = {
    Backquote: '`',
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Equal: '=',
    Minus: '-',
    Plus: 'PLUS',
    Period: '.',
    Quote: "'",
    Semicolon: ';',
    Slash: '/',
    Backspace: 'Backspace',
    CapsLock: 'Capslock',
    ContextMenu: 'Contextmenu',
    Space: 'Space',
    Tab: 'Tab',
    Convert: 'Convert',
    Delete: 'Delete',
    End: 'End',
    Help: 'Help',
    Home: 'Home',
    PageDown: 'Pagedown',
    PageUp: 'Pageup',
    Escape: 'Esc',
    PrintScreen: 'Printscreen',
    ScrollLock: 'Scrolllock',
    Pause: 'Pause',
    Insert: 'Insert',
    Suspend: 'Suspend',
};

export default function Hotkey() {
    const [disableInFullscreen, setDisableInFullscreen] = useConfig('hotkey_disable_in_fullscreen', true);
    const [selectionTranslate, setSelectionTranslate] = useConfig('hotkey_selection_translate', '');
    const [inputTranslate, setInputTranslate] = useConfig('hotkey_input_translate', '');
    const [replaceTranslate, setReplaceTranslate] = useConfig('hotkey_replace_translate', '');
    const [readAloud, setReadAloud] = useConfig('hotkey_read_aloud', '');
    const [ocrRecognize, setOcrRecognize] = useConfig('hotkey_ocr_recognize', '');
    const [ocrTranslate, setOcrTranslate] = useConfig('hotkey_ocr_translate', '');

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    function keyDown(e, setKey) {
        e.preventDefault();
        if (e.keyCode === 8) {
            setKey('');
        } else {
            let newValue = '';
            if (e.ctrlKey) {
                newValue = 'Ctrl';
            }
            if (e.shiftKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Shift`;
            }
            if (e.metaKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}${osType === 'Darwin' ? 'Command' : 'Super'}`;
            }
            if (e.altKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Alt`;
            }
            let code = e.code;
            if (code.startsWith('Key')) {
                code = code.substring(3);
            } else if (code.startsWith('Digit')) {
                code = code.substring(5);
            } else if (code.startsWith('Numpad')) {
                code = 'Num' + code.substring(6);
            } else if (code.startsWith('Arrow')) {
                code = code.substring(5);
            } else if (code.startsWith('Intl')) {
                code = code.substring(4);
            } else if (/F\d+/.test(code)) {
            } else if (keyMap[code] !== undefined) {
                code = keyMap[code];
            } else {
                code = '';
            }
            setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`);
        }
    }

    // Resolves to true when the shortcut was registered, so the recorder can leave its "unconfirmed" state.
    function registerHandler(name, key) {
        return isRegistered(key).then((res) => {
            if (res) {
                toast.error(t('config.hotkey.is_register'), { style: toastStyle });
                return false;
            }
            return invoke('register_shortcut_by_frontend', {
                name: name,
                shortcut: key,
            }).then(
                () => {
                    toast.success(t('config.hotkey.success'), { style: toastStyle });
                    return true;
                },
                (e) => {
                    toast.error(e, { style: toastStyle });
                    return false;
                }
            );
        });
    }

    // Same order as before; `name` is the config key used when registering.
    const rows = [
        {
            name: 'hotkey_selection_translate',
            label: 'selection_translate',
            value: selectionTranslate,
            set: setSelectionTranslate,
        },
        { name: 'hotkey_input_translate', label: 'input_translate', value: inputTranslate, set: setInputTranslate },
        {
            name: 'hotkey_replace_translate',
            label: 'replace_translate',
            value: replaceTranslate,
            set: setReplaceTranslate,
        },
        { name: 'hotkey_read_aloud', label: 'read_aloud', value: readAloud, set: setReadAloud },
        { name: 'hotkey_ocr_recognize', label: 'ocr_recognize', value: ocrRecognize, set: setOcrRecognize },
        { name: 'hotkey_ocr_translate', label: 'ocr_translate', value: ocrTranslate, set: setOcrTranslate },
    ];

    return (
        <>
            <Toaster />
            {osType === 'Windows_NT' && (
                <SettingsSection title={t('config.hotkey.section.behavior')}>
                    <SettingRow
                        title={t('config.hotkey.disable_in_fullscreen')}
                        description={t('config.hotkey.disable_in_fullscreen_description')}
                    >
                        <Switch
                            checked={disableInFullscreen !== false}
                            onCheckedChange={setDisableInFullscreen}
                        />
                    </SettingRow>
                </SettingsSection>
            )}
            <SettingsSection
                title={t('config.hotkey.section.title')}
                description={t('config.hotkey.section.description')}
            >
                {rows.map((row) => (
                    <SettingRow
                        key={row.name}
                        title={t(`config.hotkey.${row.label}`)}
                        description={t(`config.hotkey.${row.label}_desc`)}
                    >
                        {row.value !== null && (
                            <HotkeyRecorder
                                value={row.value}
                                placeholder={t('config.hotkey.set_hotkey')}
                                confirmLabel={t('common.ok')}
                                clearLabel={t('config.hotkey.clear')}
                                onKeyDown={(e) => {
                                    keyDown(e, row.set);
                                }}
                                onFocus={() => {
                                    unregister(row.value);
                                    row.set('');
                                }}
                                onConfirm={() => registerHandler(row.name, row.value)}
                                onClear={() => {
                                    unregister(row.value);
                                    row.set('');
                                }}
                            />
                        )}
                    </SettingRow>
                ))}
            </SettingsSection>
        </>
    );
}
