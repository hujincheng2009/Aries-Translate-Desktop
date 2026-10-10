import { useTranslation } from 'react-i18next';
import React from 'react';

import ServiceSelectDialog from '@/components/app/ServiceSelectDialog';
import { createServiceInstanceKey } from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/collection';

export default function SelectModal(props) {
    const { isOpen, onOpenChange, setCurrentConfigKey, onConfigOpen } = props;
    const { t } = useTranslation();

    const items = Object.keys(builtinServices).map((x) => ({
        key: x,
        name: t(`services.collection.${builtinServices[x].info.name}.title`),
        icon: builtinServices[x].info.icon,
    }));

    return (
        <ServiceSelectDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            serviceType='collection'
            items={items}
            onSelect={(x) => {
                onOpenChange(false);
                setCurrentConfigKey(createServiceInstanceKey(x));
                onConfigOpen();
            }}
        />
    );
}
