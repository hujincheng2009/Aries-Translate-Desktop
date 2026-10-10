import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { appWindow, currentMonitor } from '@tauri-apps/api/window';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { Pin, PinOff, X } from 'lucide-react';
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useAtomValue } from 'jotai';
import { sourceTextAtom, ocrLanguageHintAtom } from './components/SourceArea';
import { sourceLanguageAtom, targetLanguageAtom } from './components/LanguageArea';
import { resolveOcrSourceLanguage } from '../../utils/ocr_language';
import { syncAutoReadRound, getAutoReadRound } from '../../hooks/useAutoReadAloud';
import { listen } from '@tauri-apps/api/event';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import * as builtinServices from '../../services/translate';
import { filterAvailableServices } from '../../utils/service_availability';
import LanguageArea from './components/LanguageArea';
import SourceArea from './components/SourceArea';
import TargetArea from './components/TargetArea';
import ToolbarButton from '../../components/app/ToolbarButton';
import WindowDragRegion from '../../components/app/WindowDragRegion';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import {
    stopTranslationReadAloudVoice,
    useTranslationReadAloudWindowCleanup,
} from '../../hooks/useTranslationReadAloud';
import { store } from '../../utils/store';
import { info } from 'tauri-plugin-log-api';

let blurTimeout = null;
let resizeTimeout = null;
let moveTimeout = null;

const listenBlur = () => {
    return listen('tauri://blur', () => {
        if (appWindow.label === 'translate') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            info('Blur');
            // 100ms后关闭窗口，因为在 windows 下拖动窗口时会先切换成 blur 再立即切换成 focus
            // 如果直接关闭将导致窗口无法拖动
            blurTimeout = setTimeout(async () => {
                info('Confirm Blur');
                stopTranslationReadAloudVoice();
                await appWindow.close();
            }, 100);
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
    info('Focus');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});
// 监听 move 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://move', () => {
    info('Move');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});

export default function Translate() {
    useTranslationReadAloudWindowCleanup();
    const sourceText = useAtomValue(sourceTextAtom);
    const selectedSourceLanguage = useAtomValue(sourceLanguageAtom);
    const targetLanguage = useAtomValue(targetLanguageAtom);
    const ocrLanguageHint = useAtomValue(ocrLanguageHintAtom);
    const [followOcrLanguage] = useConfig('translate_follow_ocr_language', false);
    const [autoReadEnabled] = useConfig('translate_auto_read_aloud', false);
    const [onDemandList] = useConfig('translate_on_demand_service_list', []);
    const autoReadContext = JSON.stringify([
        sourceText,
        resolveOcrSourceLanguage(selectedSourceLanguage, sourceText, ocrLanguageHint, followOcrLanguage),
        targetLanguage,
    ]);
    const [closeOnBlur] = useConfig('translate_close_on_blur', true);
    const [alwaysOnTop] = useConfig('translate_always_on_top', false);
    const [windowPosition] = useConfig('translate_window_position', 'mouse');
    const [rememberWindowSize] = useConfig('translate_remember_window_size', false);
    const [translateServiceInstanceList, setTranslateServiceInstanceList] = useConfig('translate_service_list', [
        'deepl',
        'bing',

        'yandex',
        'google',
    ]);
    const [recognizeServiceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [ttsServiceInstanceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [collectionServiceInstanceList] = useConfig('collection_service_list', []);
    const [hideLanguage] = useConfig('hide_language', false);
    const [pined, setPined] = useState(false);
    const [pluginList, setPluginList] = useState(null);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const { t } = useTranslation();
    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const reordered = reorder(availableTranslateServices, result.source.index, result.destination.index);
        let index = 0;
        const items = translateServiceInstanceList.map((key) =>
            availableTranslateServices.includes(key) ? reordered[index++] : key
        );
        setTranslateServiceInstanceList(items);
    };
    // 是否自动关闭窗口
    useEffect(() => {
        if (closeOnBlur !== null && !closeOnBlur) {
            unlistenBlur();
        }
    }, [closeOnBlur]);
    // 是否默认置顶
    useEffect(() => {
        if (alwaysOnTop !== null && alwaysOnTop) {
            appWindow.setAlwaysOnTop(true);
            unlistenBlur();
            setPined(true);
        }
    }, [alwaysOnTop]);
    // 保存窗口位置
    useEffect(() => {
        if (windowPosition !== null && windowPosition === 'pre_state') {
            const unlistenMove = listen('tauri://move', async () => {
                if (moveTimeout) {
                    clearTimeout(moveTimeout);
                }
                moveTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        let position = await appWindow.outerPosition();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        position = position.toLogical(factor);
                        await store.set('translate_window_position_x', parseInt(position.x));
                        await store.set('translate_window_position_y', parseInt(position.y));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenMove.then((f) => {
                    f();
                });
            };
        }
    }, [windowPosition]);
    // 保存窗口大小
    useEffect(() => {
        if (rememberWindowSize !== null && rememberWindowSize) {
            const unlistenResize = listen('tauri://resize', async () => {
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }
                resizeTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        let size = await appWindow.outerSize();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        size = size.toLogical(factor);
                        await store.set('translate_window_height', parseInt(size.height));
                        await store.set('translate_window_width', parseInt(size.width));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenResize.then((f) => {
                    f();
                });
            };
        }
    }, [rememberWindowSize]);

    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'tts', 'recognize', 'collection'];
        let temp = {};
        for (const serviceType of serviceTypeList) {
            temp[serviceType] = {};
            if (await exists(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/${serviceType}/${plugin.name}/info.json`, {
                        dir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/${serviceType}/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    temp[serviceType][plugin.name] = pluginInfo;
                }
            }
        }
        setPluginList({ ...temp });
    };

    useEffect(() => {
        loadPluginList();
        if (!unlisten) {
            unlisten = listen('reload_plugin_list', loadPluginList);
        }
    }, []);

    const loadServiceInstanceConfigMap = async () => {
        const config = {};
        for (const serviceInstanceKey of translateServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of recognizeServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of ttsServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of collectionServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        if (
            translateServiceInstanceList !== null &&
            recognizeServiceInstanceList !== null &&
            ttsServiceInstanceList !== null &&
            collectionServiceInstanceList !== null
        ) {
            loadServiceInstanceConfigMap();
        }
    }, [
        translateServiceInstanceList,
        recognizeServiceInstanceList,
        ttsServiceInstanceList,
        collectionServiceInstanceList,
    ]);

    const availableTranslateServices = filterAvailableServices(
        translateServiceInstanceList,
        builtinServices,
        pluginList?.translate
    );
    useEffect(() => {
        if (pluginList && translateServiceInstanceList)
            filterAvailableServices(translateServiceInstanceList, builtinServices, pluginList.translate, (key) =>
                info(`Skipping unavailable translation service: ${key}`)
            );
    }, [translateServiceInstanceList, pluginList]);

    const autoCards = JSON.stringify(
        availableTranslateServices
            .filter((key) => serviceInstanceConfigMap?.[key]?.enable !== false)
            .map((id) => ({ id, status: onDemandList?.includes(id) ? 'skipped' : 'pending' }))
    );
    useLayoutEffect(() => {
        if (
            !serviceInstanceConfigMap ||
            !pluginList ||
            onDemandList === null ||
            autoReadEnabled === null ||
            followOcrLanguage === null ||
            !selectedSourceLanguage ||
            !targetLanguage
        )
            return;
        if (getAutoReadRound(autoReadContext) === null) stopTranslationReadAloudVoice();
        syncAutoReadRound(autoReadContext, JSON.parse(autoCards), autoReadEnabled === true);
    }, [
        autoReadContext,
        autoCards,
        autoReadEnabled,
        onDemandList,
        pluginList,
        serviceInstanceConfigMap,
        followOcrLanguage,
        selectedSourceLanguage,
        targetLanguage,
    ]);

    const togglePin = () => {
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
    };

    return (
        pluginList && (
            <TooltipProvider>
                <div
                    className={cn(
                        'flex h-screen w-screen flex-col bg-background text-foreground',
                        osType === 'Linux' && 'rounded-[10px] border'
                    )}
                >
                    <Toaster />
                    <div
                        className={cn(
                            'relative isolate flex h-10 shrink-0 items-center px-2',
                            osType === 'Darwin' ? 'justify-end' : 'justify-between'
                        )}
                    >
                        <WindowDragRegion />
                        <ToolbarButton
                            label={t(pined ? 'translate.unpin' : 'translate.pin')}
                            active={pined}
                            aria-pressed={pined}
                            onClick={togglePin}
                        >
                            {pined ? <PinOff /> : <Pin />}
                        </ToolbarButton>
                        {osType !== 'Darwin' && (
                            <ToolbarButton
                                label={t('common.close')}
                                onClick={() => {
                                    stopTranslationReadAloudVoice();
                                    void appWindow.close();
                                }}
                            >
                                <X />
                            </ToolbarButton>
                        )}
                    </div>
                    {/* window-scroll keeps the scrollbar out of the native resize band and 8px clear of the cards */}
                    <div className='window-scroll min-h-0 flex-1 overflow-y-auto pl-2'>
                        {serviceInstanceConfigMap !== null && (
                            <SourceArea
                                pluginList={pluginList}
                                serviceInstanceConfigMap={serviceInstanceConfigMap}
                            />
                        )}
                        <div className={cn('pb-2', hideLanguage && 'hidden')}>
                            <LanguageArea />
                        </div>
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable
                                droppableId='droppable'
                                direction='vertical'
                            >
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                    >
                                        {translateServiceInstanceList !== null &&
                                            serviceInstanceConfigMap !== null &&
                                            availableTranslateServices.map((serviceInstanceKey, index) => {
                                                const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {};
                                                const enable = config['enable'] ?? true;

                                                return enable ? (
                                                    <Draggable
                                                        key={serviceInstanceKey}
                                                        draggableId={serviceInstanceKey}
                                                        index={index}
                                                    >
                                                        {(provided) => (
                                                            // Spacing sits inside the draggable (not a flex gap) so the drag preview keeps it.
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className='pb-2'
                                                            >
                                                                <TargetArea
                                                                    {...provided.dragHandleProps}
                                                                    index={index}
                                                                    autoReadContext={autoReadContext}
                                                                    name={serviceInstanceKey}
                                                                    translateServiceInstanceList={
                                                                        availableTranslateServices
                                                                    }
                                                                    pluginList={pluginList}
                                                                    serviceInstanceConfigMap={serviceInstanceConfigMap}
                                                                />
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ) : (
                                                    <React.Fragment key={serviceInstanceKey} />
                                                );
                                            })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>
                </div>
            </TooltipProvider>
        )
    );
}
