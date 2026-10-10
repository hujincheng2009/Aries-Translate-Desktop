import * as builtinServices from '../../../../../services/translate';
import { isServiceAvailable } from '../../../../../utils/service_availability';
import { TriangleAlert } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import ServiceDragList from '@/components/app/ServiceDragList';
import ServiceTabLayout from '@/components/app/ServiceTabLayout';
import { useToastStyle } from '../../../../../hooks';
import SelectPluginModal from '../SelectPluginModal';
import { useConfig, deleteKey } from '../../../../../hooks';
import { ON_DEMAND_TRANSLATE_SERVICE_LIST_KEY } from '../../../../../utils/on_demand_translation';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';

export default function Translate(props) {
    const { pluginList } = props;
    const [isSelectPluginOpen, setIsSelectPluginOpen] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const onConfigOpen = () => setIsConfigOpen(true);
    const [currentConfigKey, setCurrentConfigKey] = useState('deepl');
    // now it's service instance list
    const [translateServiceInstanceList, setTranslateServiceInstanceList] = useConfig('translate_service_list', [
        'deepl',
        'bing',

        'yandex',
        'google',
    ]);
    const [onDemandServiceInstanceList, setOnDemandServiceInstanceList] = useConfig(
        ON_DEMAND_TRANSLATE_SERVICE_LIST_KEY,
        []
    );

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
        const items = reorder(translateServiceInstanceList, result.source.index, result.destination.index);
        setTranslateServiceInstanceList(items);
    };

    // Guard shared by the delete button (checked before the confirm dialog opens) and the delete itself.
    const canDeleteServiceInstance = () => {
        if (
            translateServiceInstanceList.length === 1 &&
            isServiceAvailable(translateServiceInstanceList[0], builtinServices, pluginList)
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
            setTranslateServiceInstanceList(translateServiceInstanceList.filter((x) => x !== instanceKey));
            setOnDemandServiceInstanceList((onDemandServiceInstanceList ?? []).filter((key) => key !== instanceKey));
            deleteKey(instanceKey);
        }
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (translateServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...translateServiceInstanceList, instanceKey];
            setTranslateServiceInstanceList(newList);
        }
    };

    return (
        <>
            <Toaster />
            <ServiceTabLayout
                isEmpty={translateServiceInstanceList?.length === 0}
                title={t('config.service.translate_title')}
                description={t('config.service.translate_desc')}
                onAddBuiltin={() => setIsSelectOpen(true)}
                onAddPlugin={() => setIsSelectPluginOpen(true)}
                notice={
                    onDemandServiceInstanceList !== null &&
                    onDemandServiceInstanceList.length > 0 && (
                        <Alert variant='warning'>
                            <TriangleAlert />
                            <AlertDescription>{t('config.service.on_demand_background_warning')}</AlertDescription>
                        </Alert>
                    )
                }
            >
                <ServiceDragList
                    list={translateServiceInstanceList}
                    onDragEnd={onDragEnd}
                    renderItem={(x, dragHandleProps) => (
                        <ServiceItem
                            {...dragHandleProps}
                            key={x}
                            serviceInstanceKey={x}
                            pluginList={pluginList}
                            deleteServiceInstance={deleteServiceInstance}
                            canDeleteServiceInstance={canDeleteServiceInstance}
                            setCurrentConfigKey={setCurrentConfigKey}
                            onConfigOpen={onConfigOpen}
                            onDemandServiceInstanceList={onDemandServiceInstanceList}
                            setOnDemandServiceInstanceList={setOnDemandServiceInstanceList}
                        />
                    )}
                />
            </ServiceTabLayout>
            <SelectPluginModal
                isOpen={isSelectPluginOpen}
                onOpenChange={setIsSelectPluginOpen}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
                pluginType='translate'
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
                pluginList={pluginList}
                isOpen={isConfigOpen}
                onOpenChange={setIsConfigOpen}
                updateServiceInstanceList={updateServiceInstanceList}
            />
        </>
    );
}
