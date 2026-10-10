import { useTranslation } from 'react-i18next';
import React from 'react';

import ServiceSelectDialog from '@/components/app/ServiceSelectDialog';
import * as builtinServices from '../../../../../../services/translate';
import { createServiceInstanceKey } from '../../../../../../utils/service_instance';

export default function SelectModal(props) {
    const { isOpen, onOpenChange, setCurrentConfigKey, onConfigOpen } = props;
    const { t } = useTranslation();

    const items = Object.keys(builtinServices).map((x) => ({
        key: x,
        name: t(`services.translate.${builtinServices[x].info.name}.title`),
        icon: builtinServices[x].info.icon,
        iconMonochrome: builtinServices[x].info.iconMonochrome,
    }));

    return (
        <ServiceSelectDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            serviceType='translate'
            items={items}
            onSelect={(x) => {
                onOpenChange(false);
                setCurrentConfigKey(createServiceInstanceKey(x));
                onConfigOpen();
            }}
        />
    );
}
