import { atom, useAtom, useSetAtom, useAtomValue } from 'jotai';
import { fetch, Body } from '@tauri-apps/api/http';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Languages, RefreshCw } from 'lucide-react';
import React, { useEffect } from 'react';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as builtinService from '../../../services/recognize';
import { languageList } from '../../../utils/language';
import { useConfig } from '../../../hooks';
import { textAtom } from '../TextArea';
import { pluginListAtom } from '..';
import { osType } from '../../../utils/env';
import {
    ServiceSourceType,
    getServiceSouceType,
    getServiceName,
    INSTANCE_NAME_CONFIG_KEY,
    getDisplayInstanceName,
} from '../../../utils/service_instance';

export const currentServiceInstanceKeyAtom = atom();
export const languageAtom = atom();
export const recognizeFlagAtom = atom();

export default function ControlArea(props) {
    const { serviceInstanceConfigMap, serviceInstanceList } = props;
    const pluginList = useAtomValue(pluginListAtom);
    const [recognizeLanguage] = useConfig('recognize_language', 'auto');
    const [serverPort] = useConfig('server_port', 60828);
    const setRecognizeFlag = useSetAtom(recognizeFlagAtom);
    const [currentServiceInstanceKey, setCurrentServiceInstanceKey] = useAtom(currentServiceInstanceKeyAtom);
    const [language, setLanguage] = useAtom(languageAtom);
    const text = useAtomValue(textAtom);
    const { t } = useTranslation();

    function getInstanceName(instanceKey, serviceNameSupplier) {
        const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {};
        return getDisplayInstanceName(instanceConfig[INSTANCE_NAME_CONFIG_KEY], serviceNameSupplier);
    }

    useEffect(() => {
        if (serviceInstanceList) {
            setCurrentServiceInstanceKey(serviceInstanceList[0]);
        }
        if (recognizeLanguage) {
            setLanguage(recognizeLanguage);
        }
    }, [serviceInstanceList, recognizeLanguage]);

    // Same expressions as before, shared by the trigger and the menu items.
    const getServiceIconSrc = (instanceKey) =>
        getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
            ? pluginList[getServiceName(instanceKey)].icon
            : builtinService[getServiceName(instanceKey)].info.icon === 'system'
              ? `logo/${osType}.svg`
              : builtinService[getServiceName(instanceKey)].info.icon;
    const getServiceLabel = (instanceKey) =>
        getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
            ? getInstanceName(instanceKey, () => pluginList[getServiceName(instanceKey)].display)
            : getInstanceName(instanceKey, () => t(`services.recognize.${instanceKey}.title`));

    return (
        <div className='flex h-14 shrink-0 items-center justify-between gap-2 px-2'>
            <div className='flex min-w-0 items-center gap-2'>
                {currentServiceInstanceKey && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant='outline'
                                className='min-w-0'
                            >
                                <img
                                    className='size-4 shrink-0'
                                    src={getServiceIconSrc(currentServiceInstanceKey)}
                                />
                                <span className='truncate'>{getServiceLabel(currentServiceInstanceKey)}</span>
                                <ChevronDown className='text-muted-foreground' />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side='top'
                            align='start'
                            aria-label='service name'
                        >
                            <DropdownMenuRadioGroup
                                value={currentServiceInstanceKey}
                                onValueChange={(key) => {
                                    setCurrentServiceInstanceKey(key);
                                }}
                            >
                                {serviceInstanceList.map((instanceKey) => {
                                    return (
                                        <DropdownMenuRadioItem
                                            key={instanceKey}
                                            value={instanceKey}
                                        >
                                            <img
                                                className='size-4 shrink-0'
                                                src={getServiceIconSrc(instanceKey)}
                                            />
                                            {getServiceLabel(instanceKey)}
                                        </DropdownMenuRadioItem>
                                    );
                                })}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                {language && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant='outline'
                                className='min-w-0'
                            >
                                <span className='truncate'>{t(`languages.${language}`)}</span>
                                <ChevronDown className='text-muted-foreground' />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side='top'
                            align='start'
                            aria-label='language'
                        >
                            <DropdownMenuRadioGroup
                                value={language}
                                onValueChange={(key) => {
                                    setLanguage(key);
                                }}
                            >
                                <DropdownMenuRadioItem value='auto'>{t('languages.auto')}</DropdownMenuRadioItem>
                                {languageList.map((name) => {
                                    return (
                                        <DropdownMenuRadioItem
                                            key={name}
                                            value={name}
                                        >
                                            {t(`languages.${name}`)}
                                        </DropdownMenuRadioItem>
                                    );
                                })}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            <div className='flex shrink-0 items-center gap-2'>
                <Button
                    variant='outline'
                    onClick={() => {
                        setRecognizeFlag(nanoid());
                    }}
                >
                    <RefreshCw />
                    {t('recognize.recognize')}
                </Button>
                <Button
                    onClick={async () => {
                        if (text) {
                            void fetch(`http://127.0.0.1:${serverPort}/translate`, {
                                method: 'POST',
                                body: Body.text(text),
                                responseType: 2,
                            });
                        }
                    }}
                >
                    <Languages />
                    {t('recognize.translate')}
                </Button>
            </div>
        </div>
    );
}
