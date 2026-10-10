import * as builtinServices from '../../services/recognize';
import { filterAvailableServices } from '../../utils/service_availability';
import { info } from 'tauri-plugin-log-api';
import { useMemo } from 'react';
import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Pin, PinOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { atom, useAtom } from 'jotai';

import WindowControl from '../../components/WindowControl';
import ToolbarButton from '../../components/app/ToolbarButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import WindowDragRegion from '../../components/app/WindowDragRegion';
import { store } from '../../utils/store';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import ControlArea from './ControlArea';
import ImageArea from './ImageArea';
import TextArea from './TextArea';

export const pluginListAtom = atom();

let blurTimeout = null;

const listenBlur = () => {
    return listen('tauri://blur', () => {
        if (appWindow.label === 'recognize') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            // 50ms后关闭窗口，因为在 windows 下拖动窗口时会先切换成 blur 再立即切换成 focus
            // 如果直接关闭将导致窗口无法拖动
            blurTimeout = setTimeout(async () => {
                await appWindow.close();
            }, 50);
        }
    });
};

let unlisten = listenBlur();
// 取消 blur 监听
const unlistenBlur = () => {
    unlisten.then((f) => {
        f();
    });
};

// 监听 focus 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://focus', () => {
    if (blurTimeout) {
        clearTimeout(blurTimeout);
    }
});

export default function Recognize() {
    const [pluginList, setPluginList] = useAtom(pluginListAtom);
    const [closeOnBlur] = useConfig('recognize_close_on_blur', false);
    const [pined, setPined] = useState(false);
    const [serviceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const { t } = useTranslation();

    const loadPluginList = async () => {
        let temp = {};
        if (await exists(`plugins/recognize`, { dir: BaseDirectory.AppConfig })) {
            const plugins = await readDir(`plugins/recognize`, { dir: BaseDirectory.AppConfig });
            for (const plugin of plugins) {
                const infoStr = await readTextFile(`plugins/recognize/${plugin.name}/info.json`, {
                    dir: BaseDirectory.AppConfig,
                });
                let pluginInfo = JSON.parse(infoStr);
                if ('icon' in pluginInfo) {
                    const appConfigDirPath = await appConfigDir();
                    const iconPath = await join(
                        appConfigDirPath,
                        `/plugins/recognize/${plugin.name}/${pluginInfo.icon}`
                    );
                    pluginInfo.icon = convertFileSrc(iconPath);
                }
                temp[plugin.name] = pluginInfo;
            }
        }
        setPluginList({ ...temp });
    };
    const loadServiceInstanceConfigMap = async () => {
        const config = {};
        for (const serviceInstanceKey of serviceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        if (serviceInstanceList !== null) {
            loadServiceInstanceConfigMap();
        }
    }, [serviceInstanceList]);

    useEffect(() => {
        loadPluginList();
    }, []);
    // 是否自动关闭窗口
    useEffect(() => {
        if (closeOnBlur !== null && !closeOnBlur) {
            unlistenBlur();
        }
    }, [closeOnBlur]);

    const availableServices = useMemo(
        () =>
            pluginList
                ? filterAvailableServices(serviceInstanceList, builtinServices, pluginList, (key) =>
                      info(`Skipping unavailable recognition service: ${key}`)
                  )
                : [],
        [serviceInstanceList, pluginList]
    );
    return (
        pluginList &&
        serviceInstanceConfigMap !== null && (
            <TooltipProvider>
                <div
                    className={cn(
                        'flex h-screen flex-col bg-background text-foreground',
                        osType === 'Linux' && 'rounded-[10px] border'
                    )}
                >
                    <div
                        className={cn(
                            'relative isolate flex h-10 shrink-0 items-center px-2',
                            osType === 'Darwin' ? 'justify-end' : 'justify-between'
                        )}
                    >
                        <WindowDragRegion />
                        <div
                            className={cn(
                                // presses on the empty part and the title fall through to the drag layer
                                'pointer-events-none flex min-w-0 items-center gap-1 [&_button]:pointer-events-auto',
                                osType !== 'Darwin' && 'h-full flex-1'
                            )}
                        >
                            <ToolbarButton
                                label={t(pined ? 'translate.unpin' : 'translate.pin')}
                                active={pined}
                                aria-pressed={pined}
                                onClick={() => {
                                    if (pined) {
                                        if (closeOnBlur) {
                                            unlisten = listenBlur();
                                        }
                                        appWindow.setAlwaysOnTop(false);
                                    } else {
                                        unlistenBlur();
                                        appWindow.setAlwaysOnTop(true);
                                    }
                                    setPined(!pined);
                                }}
                            >
                                {pined ? <PinOff /> : <Pin />}
                            </ToolbarButton>
                            {osType !== 'Darwin' && (
                                <span className='pointer-events-none flex h-full flex-1 select-none items-center truncate text-sm font-semibold'>
                                    {t('recognize.title')}
                                </span>
                            )}
                        </div>
                        {osType !== 'Darwin' && <WindowControl />}
                    </div>
                    <div className='grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-2 px-2'>
                        <ImageArea />
                        <TextArea serviceInstanceConfigMap={serviceInstanceConfigMap} />
                    </div>
                    <ControlArea
                        serviceInstanceList={availableServices}
                        serviceInstanceConfigMap={serviceInstanceConfigMap}
                    />
                </div>
            </TooltipProvider>
        )
    );
}
