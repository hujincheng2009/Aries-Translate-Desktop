import { useTranslation } from 'react-i18next';
import React from 'react';

import ServiceListItem from '@/components/app/ServiceListItem';
import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
} from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/tts';
import { useConfig } from '../../../../../../hooks';

export default function ServiceItem(props) {
    const {
        serviceInstanceKey,
        pluginList,
        deleteServiceInstance,
        canDeleteServiceInstance,
        setCurrentConfigKey,
        onConfigOpen,
        ...drag
    } = props;
    const { t } = useTranslation();

    const [serviceInstanceConfig] = useConfig(serviceInstanceKey, {});

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);
    const isPlugin = serviceSourceType === ServiceSourceType.PLUGIN;

    // Nothing to show yet (config still loading, or the plugin is uninstalled). Keep an empty drag handle so
    // react-beautiful-dnd does not warn "Unable to find drag handle".
    if (serviceInstanceConfig === null) {
        return (
            <div
                hidden
                {...drag}
            />
        );
    }

    const removed = isPlugin ? !(serviceName in pluginList) : !(serviceName in builtinServices);
    if (removed)
        return (
            <ServiceListItem
                serviceName={serviceName}
                serviceType='tts'
                dragHandleProps={drag}
                name={serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] || serviceName}
                removed
                beforeDelete={canDeleteServiceInstance}
                onDelete={() => deleteServiceInstance(serviceInstanceKey)}
            />
        );
    const icon = isPlugin ? pluginList[serviceName].icon : `${builtinServices[serviceName].info.icon}`;
    const name = isPlugin
        ? serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] || pluginList[serviceName].display
        : serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] || t(`services.tts.${serviceName}.title`);

    return (
        <ServiceListItem
            serviceName={serviceName}
            serviceType='tts'
            dragHandleProps={drag}
            name={name}
            icon={icon}
            isPlugin={isPlugin}
            onEdit={() => {
                setCurrentConfigKey(serviceInstanceKey);
                onConfigOpen();
            }}
            beforeDelete={canDeleteServiceInstance}
            onDelete={() => {
                deleteServiceInstance(serviceInstanceKey);
            }}
        />
    );
}
