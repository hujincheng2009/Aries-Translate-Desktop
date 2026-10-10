import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import React, { useEffect, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import Translate from './Translate';
import Recognize from './Recognize';
import Collection from './Collection';
import Tts from './Tts';
import { ServiceType } from '../../../../utils/service_instance';

let unlisten = null;

export default function Service() {
    const [pluginList, setPluginList] = useState(null);
    const [tab, setTab] = useState('translate');
    const { t } = useTranslation();

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
        if (unlisten) {
            unlisten.then((f) => {
                f();
            });
        }
        unlisten = listen('reload_plugin_list', loadPluginList);
        return () => {
            if (unlisten) {
                unlisten.then((f) => {
                    f();
                });
            }
        };
    }, []);
    return (
        pluginList !== null && (
            <TooltipProvider>
                <Tabs
                    value={tab}
                    onValueChange={setTab}
                    className='gap-4'
                >
                    {/* Left-aligned segmented control; the list below belongs to the active tab */}
                    <TabsList>
                        <TabsTrigger value='translate'>{t('config.service.translate')}</TabsTrigger>
                        <TabsTrigger value='recognize'>{t('config.service.recognize')}</TabsTrigger>
                        <TabsTrigger value='tts'>{t('config.service.tts')}</TabsTrigger>
                        <TabsTrigger value='collection'>{t('config.service.collection')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value='translate'>
                        <Translate pluginList={pluginList[ServiceType.TRANSLATE]} />
                    </TabsContent>
                    <TabsContent value='recognize'>
                        <Recognize pluginList={pluginList[ServiceType.RECOGNIZE]} />
                    </TabsContent>
                    <TabsContent value='tts'>
                        <Tts pluginList={pluginList[ServiceType.TTS]} />
                    </TabsContent>
                    <TabsContent value='collection'>
                        <Collection pluginList={pluginList[ServiceType.COLLECTION]} />
                    </TabsContent>
                </Tabs>
            </TooltipProvider>
        )
    );
}
