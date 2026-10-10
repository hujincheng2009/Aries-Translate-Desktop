import { useTranslation } from 'react-i18next';
import React from 'react';

import ServiceConfigDialog from '@/components/app/ServiceConfigDialog';
import * as builtinServices from '../../../../../../services/translate';
import { PluginConfig } from '../../PluginConfig';
import {
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
    whetherPluginService,
} from '../../../../../../utils/service_instance';

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
            serviceType='translate'
            hideFooter
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            icon={
                serviceSourceType === ServiceSourceType.BUILDIN
                    ? builtinServices[serviceName].info.icon
                    : pluginList[serviceName].icon
            }
            title={
                serviceSourceType === ServiceSourceType.BUILDIN
                    ? t(`services.translate.${serviceName}.title`)
                    : pluginList[serviceName].display
            }
            isPlugin={pluginServiceFlag}
            iconMonochrome={!pluginServiceFlag && builtinServices[serviceName].info.iconMonochrome}
        >
            {(onClose) => (
                <ConfigComponent
                    name={serviceName}
                    instanceKey={serviceInstanceKey}
                    pluginType='translate'
                    pluginList={pluginList}
                    updateServiceList={updateServiceInstanceList}
                    onClose={onClose}
                />
            )}
        </ServiceConfigDialog>
    );
}
