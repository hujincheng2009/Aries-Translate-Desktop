import toast, { Toaster } from 'react-hot-toast';
import * as builtinServices from '../../../../../services/recognize';
import { isServiceAvailable } from '../../../../../utils/service_availability';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import ServiceDragList from '@/components/app/ServiceDragList';
import ServiceTabLayout from '@/components/app/ServiceTabLayout';
import { useToastStyle } from '../../../../../hooks';
import SelectPluginModal from '../SelectPluginModal';
import { useConfig, deleteKey } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';

export default function Recognize(props) {
    const { pluginList } = props;
    const [isSelectPluginOpen, setIsSelectPluginOpen] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const onConfigOpen = () => setIsConfigOpen(true);
    const [currentConfigKey, setCurrentConfigKey] = useState('system');
    // now it's service instance list
    const [recognizeServiceInstanceList, setRecognizeServiceInstanceList] = useConfig('recognize_service_list', [
        'system',
        'tesseract',
    ]);

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };
    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(recognizeServiceInstanceList, result.source.index, result.destination.index);
        setRecognizeServiceInstanceList(items);
    };

    // Guard shared by the delete button (checked before the confirm dialog opens) and the delete itself.
    const canDeleteServiceInstance = () => {
        if (
            recognizeServiceInstanceList.length === 1 &&
            isServiceAvailable(recognizeServiceInstanceList[0], builtinServices, pluginList)
        ) {
            toast.error(t('config.service.least'), { style: toastStyle });
            return false;
        }
        return true;
    };
    const deleteServiceInstance = (instanceKey) => {
        if (!canDeleteServiceInstance()) {
            return;
        } else {
            setRecognizeServiceInstanceList(recognizeServiceInstanceList.filter((x) => x !== instanceKey));
            deleteKey(instanceKey);
        }
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (recognizeServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...recognizeServiceInstanceList, instanceKey];
            setRecognizeServiceInstanceList(newList);
        }
    };

    return (
        <>
            <Toaster />
            <ServiceTabLayout
                isEmpty={recognizeServiceInstanceList?.length === 0}
                title={t('config.service.recognize_title')}
                description={t('config.service.recognize_desc')}
                onAddBuiltin={() => setIsSelectOpen(true)}
                onAddPlugin={() => setIsSelectPluginOpen(true)}
            >
                <ServiceDragList
                    list={recognizeServiceInstanceList}
                    onDragEnd={onDragEnd}
                    renderItem={(x, dragHandleProps) => (
                        <ServiceItem
                            {...dragHandleProps}
                            serviceInstanceKey={x}
                            key={x}
                            pluginList={pluginList}
                            deleteServiceInstance={deleteServiceInstance}
                            canDeleteServiceInstance={canDeleteServiceInstance}
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
                pluginType='recognize'
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
