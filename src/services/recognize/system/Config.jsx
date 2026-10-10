import { ConfigFooter, ConfigForm, ConfigNote } from '@/components/app/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

export function Config(props) {
    const { updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ConfigForm
            onSubmit={(e) => {
                e.preventDefault();
                updateServiceList('system');
                onClose();
            }}
        >
            <ConfigNote>{t('services.no_need')}</ConfigNote>
            <ConfigFooter onCancel={onClose} />
        </ConfigForm>
    );
}
