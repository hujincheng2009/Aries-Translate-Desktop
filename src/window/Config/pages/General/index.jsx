import { enable, isEnabled, disable } from 'tauri-plugin-autostart-api';
import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { info } from 'tauri-plugin-log-api';
import 'flag-icons/css/flag-icons.min.css';
import { invoke } from '@tauri-apps/api';
import { buildFontFamily } from '../../../../utils/font_family';
import { useTheme } from 'next-themes';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsSection from '../../../../components/app/SettingsSection';
import SettingRow, { SettingFields } from '../../../../components/app/SettingRow';
import AccentPicker from '@/components/app/AccentPicker';
import { applyAccent } from '@/utils/accent';
import { useConfig } from '../../../../hooks/useConfig';
import { LanguageFlag } from '../../../../utils/language';
import { useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';

let timer = null;

const languageName = {
    zh_cn: '简体中文',
    zh_tw: '繁體中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    ru: 'Русский',
    it: 'Italiano',
    tr: 'Türkçe',
    pt_pt: 'Português',
    pt_br: 'Português (Brasil)',
    nb_no: 'Norsk Bokmål',
    nn_no: 'Norsk Nynorsk',
    fa: 'فارسی',
    uk: 'Українська',
    ar: 'العربية',
    he: 'עִבְרִית',
};

// Flag shown for each display language (zh_tw keeps the zh_cn flag like before).
const languageFlag = {
    zh_tw: LanguageFlag.zh_cn,
};

export default function General() {
    const [autoStart, setAutoStart] = useState(false);
    const [fontList, setFontList] = useState(null);
    const [serverPort, setServerPort] = useConfig('server_port', 60828);
    const [appLanguage, setAppLanguage] = useConfig('app_language', 'en');
    const [appTheme, setAppTheme] = useConfig('app_theme', 'system');
    const [appAccent, setAppAccent] = useConfig('app_accent', 'neutral');
    const [appFont, setAppFont] = useConfig('app_font', 'default');
    const [appFallbackFont, setAppFallbackFont] = useConfig('app_fallback_font', 'default');
    const [appFontSize, setAppFontSize] = useConfig('app_font_size', 16);
    const [transparent, setTransparent] = useConfig('transparent', true);
    const [devMode, setDevMode] = useConfig('dev_mode', false);
    const [trayClickEvent, setTrayClickEvent] = useConfig('tray_click_event', 'config');
    const [proxyEnable, setProxyEnable] = useConfig('proxy_enable', false);
    const [proxyHost, setProxyHost] = useConfig('proxy_host', '');
    const [proxyPort, setProxyPort] = useConfig('proxy_port', '');
    const [proxyUsername, setProxyUsername] = useConfig('proxy_username', '');
    const [proxyPassword, setProxyPassword] = useConfig('proxy_password', '');
    const [noProxy, setNoProxy] = useConfig('no_proxy', 'localhost,127.0.0.1');
    const { t, i18n } = useTranslation();
    const { setTheme } = useTheme();
    const toastStyle = useToastStyle();

    useEffect(() => {
        isEnabled().then((v) => {
            setAutoStart(v);
        });
        invoke('font_list').then((v) => {
            setFontList(v);
        });
    }, []);

    function changeTheme(key) {
        setAppTheme(key);
        if (key !== 'system') {
            setTheme(key);
        } else {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setTheme('dark');
            } else {
                setTheme('light');
            }
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (e.matches) {
                    setTheme('dark');
                } else {
                    setTheme('light');
                }
            });
        }
    }

    function renderFontItems() {
        return (
            <>
                <SelectItem
                    value='default'
                    style={{ fontFamily: buildFontFamily('default', 'default') }}
                >
                    {t('config.general.default_font')}
                </SelectItem>
                {fontList
                    .filter((x) => x !== '')
                    .map((x) => {
                        return (
                            <SelectItem
                                key={x}
                                value={x}
                                style={{ fontFamily: x }}
                            >
                                {x}
                            </SelectItem>
                        );
                    })}
            </>
        );
    }

    return (
        <>
            <Toaster />
            <SettingsSection
                title={t('config.general.section.startup')}
                description={t('config.general.section.startup_desc')}
            >
                <SettingRow
                    title={t('config.general.auto_start')}
                    description={t('config.general.auto_start_desc')}
                >
                    <Switch
                        checked={autoStart}
                        onCheckedChange={(v) => {
                            setAutoStart(v);
                            if (v) {
                                enable().then(() => {
                                    info('Auto start enabled');
                                });
                            } else {
                                disable().then(() => {
                                    info('Auto start disabled');
                                });
                            }
                        }}
                    />
                </SettingRow>
                <SettingRow
                    title={t('config.general.server_port')}
                    description={t('config.general.server_port_desc')}
                >
                    {serverPort !== null && (
                        <Input
                            type='number'
                            value={serverPort}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (parseInt(v) !== serverPort) {
                                    if (timer) {
                                        clearTimeout(timer);
                                    }
                                    timer = setTimeout(() => {
                                        toast.success(t('config.general.server_port_change'), {
                                            duration: 3000,
                                            style: toastStyle,
                                        });
                                    }, 1000);
                                }
                                if (v === '') {
                                    setServerPort(0);
                                } else if (parseInt(v) > 65535) {
                                    setServerPort(65535);
                                } else if (parseInt(v) < 0) {
                                    setServerPort(0);
                                } else {
                                    setServerPort(parseInt(v));
                                }
                            }}
                            className='w-[7.5rem]'
                        />
                    )}
                </SettingRow>
            </SettingsSection>

            <SettingsSection
                title={t('config.general.section.appearance')}
                description={t('config.general.section.appearance_desc')}
            >
                <SettingRow title={t('config.general.app_language')}>
                    {appLanguage !== null && (
                        <Select
                            value={appLanguage}
                            onValueChange={(key) => {
                                setAppLanguage(key);
                                i18n.changeLanguage(key);
                                invoke('update_tray', { language: key, copyMode: '' });
                            }}
                        >
                            <SelectTrigger aria-label={t('config.general.app_language')}>
                                <SelectValue>
                                    <span
                                        className={`fi fi-${languageFlag[appLanguage] ?? LanguageFlag[appLanguage]}`}
                                    />
                                    {languageName[appLanguage]}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className='max-h-[40vh]'>
                                {Object.keys(languageName).map((key) => (
                                    <SelectItem
                                        key={key}
                                        value={key}
                                    >
                                        <span className={`fi fi-${languageFlag[key] ?? LanguageFlag[key]}`} />
                                        {languageName[key]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </SettingRow>
                <SettingRow title={t('config.general.app_theme')}>
                    {appTheme !== null && (
                        <Tabs
                            value={appTheme}
                            onValueChange={changeTheme}
                        >
                            <TabsList aria-label={t('config.general.app_theme')}>
                                <TabsTrigger value='light'>
                                    <Sun />
                                    {t('config.general.theme.light')}
                                </TabsTrigger>
                                <TabsTrigger value='dark'>
                                    <Moon />
                                    {t('config.general.theme.dark')}
                                </TabsTrigger>
                                <TabsTrigger value='system'>
                                    <Monitor />
                                    {t('config.general.theme.system')}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                </SettingRow>
                <SettingRow
                    title={t('config.general.app_accent')}
                    description={t('config.general.app_accent_desc')}
                >
                    <AccentPicker
                        value={appAccent}
                        onChange={(value) => {
                            applyAccent(value);
                            setAppAccent(value);
                        }}
                    />
                </SettingRow>
                <SettingRow
                    title={t('config.general.app_font')}
                    description={t('config.general.app_font_desc')}
                >
                    {appFont !== null && fontList !== null && (
                        <Select
                            value={appFont}
                            onValueChange={(key) => {
                                document.documentElement.style.fontFamily = buildFontFamily(key, appFallbackFont);
                                setAppFont(key);
                            }}
                        >
                            <SelectTrigger
                                aria-label={t('config.general.app_font')}
                                style={{ fontFamily: buildFontFamily(appFont, appFallbackFont) }}
                            >
                                <SelectValue>
                                    {appFont === 'default' ? t('config.general.default_font') : appFont}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className='max-h-[50vh]'>{renderFontItems()}</SelectContent>
                        </Select>
                    )}
                </SettingRow>
                <SettingRow
                    title={t('config.general.app_fallback_font')}
                    description={t('config.general.app_fallback_font_desc')}
                >
                    {appFallbackFont !== null && fontList !== null && (
                        <Select
                            value={appFallbackFont}
                            onValueChange={(key) => {
                                document.documentElement.style.fontFamily = buildFontFamily(appFont, key);
                                setAppFallbackFont(key);
                            }}
                        >
                            <SelectTrigger
                                aria-label={t('config.general.app_fallback_font')}
                                style={{ fontFamily: buildFontFamily(appFont, appFallbackFont) }}
                            >
                                <SelectValue>
                                    {appFallbackFont === 'default' ? t('config.general.default_font') : appFallbackFont}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className='max-h-[50vh]'>{renderFontItems()}</SelectContent>
                        </Select>
                    )}
                </SettingRow>
                <SettingRow title={t('config.general.font_size.title')}>
                    {appFontSize !== null && (
                        <Select
                            value={String(appFontSize)}
                            onValueChange={(key) => {
                                document.documentElement.style.fontSize = `${key}px`;
                                setAppFontSize(key);
                            }}
                        >
                            <SelectTrigger aria-label={t('config.general.font_size.title')}>
                                <SelectValue>{t(`config.general.font_size.${appFontSize}`)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className='max-h-[50vh]'>
                                {[10, 12, 14, 16, 18, 20, 24].map((size) => (
                                    <SelectItem
                                        key={size}
                                        value={String(size)}
                                    >
                                        {t(`config.general.font_size.${size}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </SettingRow>
                {osType !== 'Darwin' && (
                    <SettingRow
                        title={t('config.general.transparent')}
                        description={t('config.general.transparent_desc')}
                    >
                        {transparent !== null && (
                            <Switch
                                checked={transparent}
                                onCheckedChange={(v) => {
                                    setTransparent(v);
                                }}
                            />
                        )}
                    </SettingRow>
                )}
                <SettingRow
                    title={t('config.general.dev_mode')}
                    description={t('config.general.dev_mode_desc')}
                >
                    {devMode !== null && (
                        <Switch
                            checked={devMode}
                            onCheckedChange={(v) => {
                                setDevMode(v);
                            }}
                        />
                    )}
                </SettingRow>
            </SettingsSection>

            {osType === 'Windows_NT' && (
                <SettingsSection
                    title={t('config.general.section.tray')}
                    description={t('config.general.section.tray_desc')}
                >
                    <SettingRow
                        title={t('config.general.tray_click_event')}
                        description={t('config.general.tray_click_event_desc')}
                    >
                        {trayClickEvent !== null && (
                            <Select
                                value={trayClickEvent}
                                onValueChange={(key) => {
                                    setTrayClickEvent(key);
                                }}
                            >
                                <SelectTrigger aria-label={t('config.general.tray_click_event')}>
                                    <SelectValue>{t(`config.general.event.${trayClickEvent}`)}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='config'>{t('config.general.event.config')}</SelectItem>
                                    <SelectItem value='translate'>{t('config.general.event.translate')}</SelectItem>
                                    <SelectItem value='ocr_recognize'>
                                        {t('config.general.event.ocr_recognize')}
                                    </SelectItem>
                                    <SelectItem value='ocr_translate'>
                                        {t('config.general.event.ocr_translate')}
                                    </SelectItem>
                                    <SelectItem value='disable'>{t('config.general.event.disable')}</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </SettingRow>
                </SettingsSection>
            )}

            <SettingsSection
                title={t('config.general.proxy.title')}
                description={t('config.general.section.proxy_desc')}
            >
                <SettingRow
                    title={t('config.general.proxy.enable')}
                    description={t('config.general.proxy.enable_desc')}
                >
                    {proxyEnable !== null && (
                        <Switch
                            checked={proxyEnable}
                            onCheckedChange={async (v) => {
                                if (v) {
                                    if (proxyHost === '' || proxyPort === '') {
                                        setProxyEnable(false);
                                        toast.error(t('config.general.proxy_error'), {
                                            duration: 3000,
                                            style: toastStyle,
                                        });
                                        return;
                                    } else {
                                        setProxyEnable(v);
                                    }
                                } else {
                                    setProxyEnable(v);
                                }
                                toast.success(t('config.general.proxy_change'), {
                                    duration: 1000,
                                    style: toastStyle,
                                });
                            }}
                        />
                    )}
                </SettingRow>
                <SettingFields>
                    <div className='grid grid-cols-[minmax(0,1fr)_10rem] gap-4'>
                        {proxyHost !== null && (
                            <div className='flex flex-col gap-2'>
                                <Label htmlFor='proxy-host'>{t('config.general.proxy.host')}</Label>
                                <div className='relative'>
                                    <span className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
                                        http://
                                    </span>
                                    <Input
                                        id='proxy-host'
                                        type='url'
                                        required
                                        placeholder='127.0.0.1'
                                        value={proxyHost}
                                        onChange={(e) => {
                                            setProxyHost(e.target.value);
                                        }}
                                        className='pl-[3.25rem]'
                                    />
                                </div>
                            </div>
                        )}
                        {proxyPort !== null && (
                            <div className='flex flex-col gap-2'>
                                <Label htmlFor='proxy-port'>{t('config.general.proxy.port')}</Label>
                                <Input
                                    id='proxy-port'
                                    type='number'
                                    required
                                    placeholder='7890'
                                    value={proxyPort}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (parseInt(v) > 65535) {
                                            setProxyPort(65535);
                                        } else if (parseInt(v) < 0) {
                                            setProxyPort('');
                                        } else {
                                            setProxyPort(parseInt(v));
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                        {proxyUsername !== null && (
                            <div className='flex flex-col gap-2'>
                                <Label
                                    htmlFor='proxy-username'
                                    className='text-muted-foreground'
                                >
                                    {t('config.general.proxy.username')}
                                </Label>
                                <Input
                                    id='proxy-username'
                                    type='text'
                                    disabled
                                    placeholder={t('config.general.proxy.unsupported')}
                                    value={proxyUsername}
                                    onChange={(e) => {
                                        setProxyUsername(e.target.value);
                                    }}
                                />
                            </div>
                        )}
                        {proxyPassword !== null && (
                            <div className='flex flex-col gap-2'>
                                <Label
                                    htmlFor='proxy-password'
                                    className='text-muted-foreground'
                                >
                                    {t('config.general.proxy.password')}
                                </Label>
                                <Input
                                    id='proxy-password'
                                    type='password'
                                    disabled
                                    placeholder={t('config.general.proxy.unsupported')}
                                    value={proxyPassword}
                                    onChange={(e) => {
                                        setProxyPassword(e.target.value);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    {noProxy !== null && (
                        <div className='flex flex-col gap-2'>
                            <Label htmlFor='proxy-no-proxy'>{t('config.general.proxy.no_proxy')}</Label>
                            <Input
                                id='proxy-no-proxy'
                                value={noProxy}
                                onChange={(e) => {
                                    setNoProxy(e.target.value);
                                }}
                            />
                            <p className='text-[0.8125rem] leading-5 text-muted-foreground'>
                                {t('config.general.proxy.no_proxy_hint')}
                            </p>
                        </div>
                    )}
                </SettingFields>
            </SettingsSection>
        </>
    );
}
