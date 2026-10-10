import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ExternalLink } from 'lucide-react';
import { open } from '@tauri-apps/api/shell';
import { Button } from '@/components/ui/button';
import { getServiceMeta } from '@/services/service_meta';
import { hasServiceGuide } from '@/services/guides';
import ServiceGuideDialog from './ServiceGuideDialog';

export default function ServiceGuideCallout({ serviceName, serviceType }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const meta = getServiceMeta(serviceName, serviceType);
    if (!meta) return null;
    const hasGuide = hasServiceGuide(meta.provider);
    return (
        <section
            className='mb-4 space-y-2 rounded-md border bg-muted/40 p-4 text-sm'
            aria-label={t('services.guide.about')}
        >
            <p className='leading-5'>{t(meta.summaryKey)}</p>
            {meta.quotaKey && <p className='leading-5 text-muted-foreground'>{t(meta.quotaKey)}</p>}
            <div className='flex flex-wrap gap-2'>
                {meta.applyUrl && (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => open(meta.applyUrl)}
                    >
                        <ExternalLink />
                        {t(meta.applyLabelKey ?? 'services.guide.apply')}
                    </Button>
                )}
                {hasGuide && (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => setIsOpen(true)}
                    >
                        <BookOpen />
                        {t('services.guide.view')}
                    </Button>
                )}
                {!hasGuide && meta.docsUrl && (
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => open(meta.docsUrl)}
                    >
                        <BookOpen />
                        {t('services.guide.official')}
                    </Button>
                )}
            </div>
            {hasGuide && (
                <ServiceGuideDialog
                    provider={meta.provider}
                    isOpen={isOpen}
                    onOpenChange={setIsOpen}
                />
            )}
        </section>
    );
}
