import { Package, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { Button } from '@/components/ui/button';

// Body of one service tab: heading + description, the list (children), an optional notice, and the two add buttons.
export default function ServiceTabLayout({
    title,
    description,
    notice,
    onAddBuiltin,
    onAddPlugin,
    isEmpty = false,
    children,
}) {
    const { t } = useTranslation();

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-0.5'>
                <h3 className='text-base font-medium leading-6'>{title}</h3>
                <p className='text-sm leading-5 text-muted-foreground'>{description}</p>
            </div>
            {isEmpty ? (
                <div className='flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center'>
                    <Package className='size-8 text-muted-foreground' />
                    <p className='text-sm text-muted-foreground'>{t('services.empty.description')}</p>
                    <div className='flex flex-wrap justify-center gap-2'>
                        <Button
                            variant='outline'
                            onClick={onAddBuiltin}
                        >
                            <Plus />
                            {t('config.service.add_service')}
                        </Button>
                        <Button
                            variant='outline'
                            onClick={onAddPlugin}
                        >
                            <Package />
                            {t('config.service.add_external_service')}
                        </Button>
                    </div>
                </div>
            ) : (
                children
            )}
            {notice}
            {!isEmpty && (
                <div className='grid grid-cols-2 gap-3'>
                    <Button
                        variant='outline'
                        onClick={onAddBuiltin}
                    >
                        <Plus />
                        {t('config.service.add_builtin_service')}
                    </Button>
                    <Button
                        variant='outline'
                        onClick={onAddPlugin}
                    >
                        <Package />
                        {t('config.service.add_external_service')}
                    </Button>
                </div>
            )}
        </div>
    );
}
