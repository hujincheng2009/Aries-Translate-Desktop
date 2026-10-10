import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import ServiceDragList from '@/components/app/ServiceDragList';
import ServiceTabLayout from '@/components/app/ServiceTabLayout';
import SelectPluginModal from '../SelectPluginModal';
import { useConfig, deleteKey } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';

export default function Collection(props) {
    const { pluginList } = props;
    const [isSelectPluginOpen, setIsSelectPluginOpen] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const onConfigOpen = () => setIsConfigOpen(true);
    const [currentConfigKey, setCurrentConfigKey] = useState('anki');
    // now it's service instance list
    const [collectionServiceInstanceList, setCollectionServiceInstanceList] = useConfig('collection_service_list', []);

    const { t } = useTranslation();

    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };
    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(collectionServiceInstanceList, result.source.index, result.destination.index);
        setCollectionServiceInstanceList(items);
    };

    const deleteServiceInstance = (instanceKey) => {
        setCollectionServiceInstanceList(collectionServiceInstanceList.filter((x) => x !== instanceKey));
        deleteKey(instanceKey);
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (collectionServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...collectionServiceInstanceList, instanceKey];
            setCollectionServiceInstanceList(newList);
        }
    };

    return (
        <>
            <ServiceTabLayout
                isEmpty={collectionServiceInstanceList?.length === 0}
                title={t('config.service.collection_title')}
                description={t('config.service.collection_desc')}
                onAddBuiltin={() => setIsSelectOpen(true)}
                onAddPlugin={() => setIsSelectPluginOpen(true)}
            >
                <ServiceDragList
                    list={collectionServiceInstanceList}
                    onDragEnd={onDragEnd}
                    renderItem={(x, dragHandleProps) => (
                        <ServiceItem
                            {...dragHandleProps}
                            serviceInstanceKey={x}
                            key={x}
                            pluginList={pluginList}
                            deleteServiceInstance={deleteServiceInstance}
                            setCurrentConfigKey={setCurrentConfigKey}
                            onConfigOpen={onConfigOpen}
                        />
                    )}
                />
            </ServiceTabLayout>
            <SelectPluginModal
                isOpen={isSelectPluginOpen}
                onOpenChange={setIsSelectPluginOpen}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
                pluginType='collection'
                pluginList={pluginList}
                deleteService={deleteServiceInstance}
            />
            <SelectModal
                isOpen={isSelectOpen}
                onOpenChange={setIsSelectOpen}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
            />
            <ConfigModal
                serviceInstanceKey={currentConfigKey}
                isOpen={isConfigOpen}
                pluginList={pluginList}
                onOpenChange={setIsConfigOpen}
                updateServiceInstanceList={updateServiceInstanceList}
            />
        </>
    );
}
