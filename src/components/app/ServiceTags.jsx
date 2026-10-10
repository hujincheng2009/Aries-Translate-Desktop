import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { getServiceMeta } from '@/services/service_meta';

export default function ServiceTags({ serviceName, serviceType }) {
    const { t } = useTranslation();
    const tags = getServiceMeta(serviceName, serviceType)?.tags ?? [];
    return tags.length ? (
        <span className='flex flex-wrap items-center gap-1'>
            {tags.map((tag) => (
                <Badge
                    key={tag}
                    variant='secondary'
                    className='whitespace-nowrap'
                >
                    {t(`services.tags.${tag}`)}
                </Badge>
            ))}
        </span>
    ) : null;
}
