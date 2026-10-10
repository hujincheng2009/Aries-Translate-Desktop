import React, { useId, useState } from 'react';
import { ChevronDown, ExternalLink, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { serviceMeta } from '@/services/service_meta';
import { cn } from '@/lib/utils';

export default function ServiceRecommendations({ currentProvider }) {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState(null);
    const sectionId = useId();
    return (
        <section
            className='space-y-2'
            aria-labelledby={sectionId}
        >
            <div className='flex flex-wrap items-center gap-x-1.5 gap-y-1'>
                <h3
                    id={sectionId}
                    className='text-sm font-medium'
                >
                    {t('services.recommendations.title')}
                </h3>
                <p className='text-xs text-muted-foreground'>{t('services.recommendations.hint')}</p>
            </div>
            <div className='divide-y overflow-hidden rounded-md border bg-card text-sm'>
                {serviceMeta.openai.recommendations.map((item) => {
                    const expanded = expandedId === item.id;
                    const triggerId = `${sectionId}-${item.id}-trigger`;
                    const contentId = `${sectionId}-${item.id}-content`;
                    return (
                        <div key={item.id}>
                            <Button
                                id={triggerId}
                                type='button'
                                variant='ghost'
                                className='h-auto min-h-11 w-full justify-between gap-2 whitespace-normal rounded-none px-3 py-2 text-left font-normal'
                                aria-expanded={expanded}
                                aria-controls={contentId}
                                onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                            >
                                <span className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1'>
                                    <span className='font-medium'>{t('services.translate.openai.' + item.id)}</span>
                                    {item.tags.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant='secondary'
                                            className={
                                                tag === 'privacy'
                                                    ? 'border-warning-border bg-warning text-warning-foreground'
                                                    : undefined
                                            }
                                        >
                                            {t('services.recommendations.tags.' + tag)}
                                        </Badge>
                                    ))}
                                </span>
                                {currentProvider === item.id && (
                                    <Badge variant='outline'>{t('services.recommendations.current')}</Badge>
                                )}
                                <ChevronDown
                                    aria-hidden='true'
                                    className={cn(
                                        'shrink-0 text-muted-foreground transition-transform duration-200',
                                        expanded && 'rotate-180'
                                    )}
                                />
                            </Button>
                            <div
                                id={contentId}
                                role='region'
                                aria-labelledby={triggerId}
                                aria-hidden={!expanded}
                                inert={expanded ? undefined : ''}
                                className={cn(
                                    'grid transition-[grid-template-rows] duration-200 ease-in-out',
                                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                )}
                            >
                                <div className='min-h-0 overflow-hidden'>
                                    <div className='space-y-3 px-3 pb-3 text-[0.8125rem] leading-5'>
                                        <p className='text-muted-foreground'>{t(item.reasonKey)}</p>
                                        {item.privacyWarning && (
                                            <Alert
                                                variant='warning'
                                                className='gap-x-2 px-3 py-2.5'
                                            >
                                                <TriangleAlert aria-hidden='true' />
                                                <AlertDescription className='text-[0.8125rem] leading-5'>
                                                    {t('services.recommendations.privacy')}
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() => open(item.website)}
                                        >
                                            <ExternalLink aria-hidden='true' />
                                            {t('services.recommendations.website')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className='text-xs leading-[1.125rem] text-muted-foreground'>
                {t('services.recommendations.relay_note')}
            </p>
        </section>
    );
}
