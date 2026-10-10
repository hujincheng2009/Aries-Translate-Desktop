import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import OptionSelect from './OptionSelect';
import ServiceTags from './ServiceTags';
import ServiceIcon from './ServiceIcon';
import { getServiceMeta } from '@/services/service_meta';
import { filterServiceItems } from '@/utils/service_form';

// "Add built-in service" dialog shared by the four service tabs.
// `items` is [{ key, name, icon }] where `name` is the displayed (translated) title; `serviceType` is the
// i18n type key (translate | recognize | tts | collection). The search box filters by displayed name.
export default function ServiceSelectDialog({ isOpen, onOpenChange, serviceType, items, onSelect }) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [tag, setTag] = useState('all');

    const filtered = filterServiceItems(items, { query, tag, serviceType, translate: t });

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    setQuery('');
                    setTag('all');
                }
                onOpenChange(open);
            }}
        >
            <DialogContent className='grid-cols-[minmax(0,1fr)] sm:max-w-[36rem]'>
                <DialogHeader>
                    <DialogTitle>{t('config.service.add_service')}</DialogTitle>
                    <DialogDescription>
                        {t('config.service.add_service_desc', { type: t(`config.service.type_${serviceType}`) })}
                    </DialogDescription>
                </DialogHeader>
                <div className='flex flex-wrap gap-2'>
                    <div className='relative min-w-40 flex-1'>
                        <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                        <Input
                            value={query}
                            placeholder={t('config.service.search_placeholder')}
                            className='pl-8'
                            onChange={(e) => {
                                setQuery(e.target.value);
                            }}
                        />
                    </div>
                    <OptionSelect
                        value={tag}
                        label={t(`services.tags.${tag}`)}
                        ariaLabel={t('services.tags.filter')}
                        options={['all', 'free', 'free_quota', 'local', 'relay'].map((value) => ({
                            value,
                            label: t(`services.tags.${value}`),
                        }))}
                        onChange={setTag}
                        className='w-[9rem]'
                    />
                </div>
                {/* min-height follows the full list so the dialog does not jump while the filter changes */}
                <div
                    className='-mx-1 flex max-h-[min(22.5rem,calc(100vh-16rem))] flex-col overflow-y-auto px-1'
                    style={{ minHeight: `min(${items.length * 4}rem, 22.5rem, calc(100vh - 16rem))` }}
                >
                    {filtered.length === 0 ? (
                        <p className='py-6 text-center text-sm text-muted-foreground'>{t('config.service.no_match')}</p>
                    ) : (
                        filtered.map((item) => (
                            <button
                                key={item.key}
                                type='button'
                                className='flex min-h-16 w-full shrink-0 items-start gap-3 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent'
                                onClick={() => {
                                    onSelect(item.key);
                                }}
                            >
                                <ServiceIcon
                                    src={item.icon}
                                    iconMonochrome={item.iconMonochrome}
                                    className='size-5 shrink-0'
                                    draggable={false}
                                />
                                <span className='min-w-0 flex-1 space-y-1'>
                                    <span className='flex flex-wrap items-center gap-2'>
                                        <span className='font-medium'>{item.name}</span>
                                        <ServiceTags
                                            serviceName={item.key}
                                            serviceType={serviceType}
                                        />
                                    </span>
                                    {getServiceMeta(item.key, serviceType)?.summaryKey && (
                                        <span
                                            className='block truncate text-xs leading-4 text-muted-foreground'
                                            title={t(getServiceMeta(item.key, serviceType).summaryKey)}
                                        >
                                            {t(getServiceMeta(item.key, serviceType).summaryKey)}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))
                    )}
                </div>
                <DialogFooter className='items-center sm:justify-between'>
                    <span className='text-xs text-muted-foreground'>
                        {t('config.service.total_count', { n: filtered.length })}
                    </span>
                    <Button
                        variant='outline'
                        onClick={() => {
                            onOpenChange(false);
                        }}
                    >
                        {t('common.cancel')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
