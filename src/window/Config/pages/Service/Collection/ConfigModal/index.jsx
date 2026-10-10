import { useTranslation } from 'react-i18next';
import React from 'react';

import ServiceConfigDialog from '@/components/app/ServiceConfigDialog';
import {
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
    whetherPluginService,
} from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/collection';
import { PluginConfig } from '../../PluginConfig';

export default function ConfigModal(props) {
    const { serviceInstanceKey, pluginList, isOpen, onOpenChange, updateServiceInstanceList } = props;

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const pluginServiceFlag = whetherPluginService(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);
    const { t } = useTranslation();
    const ConfigComponent = pluginServiceFlag ? PluginConfig : builtinServices[serviceName].Config;

    return pluginServiceFlag && !(serviceName in pluginList) ? (
        <></>
    ) : (
        <ServiceConfigDialog
            key={serviceInstanceKey}
            serviceName={serviceName}
            serviceType='collection'
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            icon={
                serviceSourceType === ServiceSourceType.BUILDIN
                    ? builtinServices[serviceName].info.icon
                    : pluginList[serviceName].icon
            }
            title={
                serviceSourceType === ServiceSourceType.BUILDIN
                    ? t(`services.collection.${serviceName}.title`)
                    : pluginList[serviceName].display
            }
            isPlugin={pluginServiceFlag}
        >
            {(onClose) => (
                <ConfigComponent
                    name={serviceName}
                    instanceKey={serviceInstanceKey}
                    pluginType='collection'
                    pluginList={pluginList}
                    updateServiceList={updateServiceInstanceList}
                    onClose={onClose}
                />
            )}
        </ServiceConfigDialog>
    );
}
