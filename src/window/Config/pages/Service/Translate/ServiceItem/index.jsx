import { useTranslation } from 'react-i18next';
import React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ServiceListItem from '@/components/app/ServiceListItem';
import * as builtinServices from '../../../../../../services/translate';
import { useConfig } from '../../../../../../hooks';
import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getDisplayInstanceName,
    getServiceName,
    getServiceSouceType,
} from '../../../../../../utils/service_instance';

export default function ServiceItem(props) {
    const {
        serviceInstanceKey,
        pluginList,
        deleteServiceInstance,
        canDeleteServiceInstance,
        setCurrentConfigKey,
        onConfigOpen,
        onDemandServiceInstanceList,
        setOnDemandServiceInstanceList,
        ...drag
    } = props;
    const { t } = useTranslation();
    const [serviceInstanceConfig, setServiceInstanceConfig] = useConfig(serviceInstanceKey, {});

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
                serviceType='translate'
                dragHandleProps={drag}
                name={serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] || serviceName}
                removed
                beforeDelete={canDeleteServiceInstance}
                onDelete={() => deleteServiceInstance(serviceInstanceKey)}
            />
        );
    const icon = isPlugin ? pluginList[serviceName].icon : `${builtinServices[serviceName].info.icon}`;
    const name = isPlugin
        ? getDisplayInstanceName(serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY], () => pluginList[serviceName].display)
        : getDisplayInstanceName(serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY], () =>
              t(`services.translate.${serviceName}.title`)
          );

    return (
        <ServiceListItem
            serviceName={serviceName}
            serviceType='translate'
            dragHandleProps={drag}
            name={name}
            icon={icon}
            iconMonochrome={!isPlugin && builtinServices[serviceName].info.iconMonochrome}
            isPlugin={isPlugin}
            onEdit={() => {
                setCurrentConfigKey(serviceInstanceKey);
                onConfigOpen();
            }}
            beforeDelete={canDeleteServiceInstance}
            onDelete={() => {
                deleteServiceInstance(serviceInstanceKey);
            }}
            actions={
                <>
                    {onDemandServiceInstanceList !== null && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <label className='flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground'>
                                    <Checkbox
                                        checked={onDemandServiceInstanceList.includes(serviceInstanceKey)}
                                        onCheckedChange={(selected) => {
                                            setOnDemandServiceInstanceList(
                                                selected === true
                                                    ? [...onDemandServiceInstanceList, serviceInstanceKey]
                                                    : onDemandServiceInstanceList.filter(
                                                          (key) => key !== serviceInstanceKey
                                                      )
                                            );
                                        }}
                                    />
                                    <span className='whitespace-nowrap'>{t('config.service.on_demand')}</span>
                                </label>
                            </TooltipTrigger>
                            <TooltipContent className='max-w-64'>
                                {t('config.service.on_demand_tooltip')}
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <Switch
                        checked={serviceInstanceConfig['enable'] ?? true}
                        onCheckedChange={(v) => {
                            setServiceInstanceConfig({ ...serviceInstanceConfig, enable: v });
                        }}
                    />
                </>
            }
        />
    );
}
