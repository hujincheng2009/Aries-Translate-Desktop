import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { accents, accentFromKey, normalizeAccent } from '@/utils/accent';
import { cn } from '@/lib/utils';

export default function AccentPicker({ value, onChange, ...props }) {
    const { t } = useTranslation();
    const buttons = useRef({});
    const selected = normalizeAccent(value);
    return (
        <TooltipProvider>
            <div className='flex flex-wrap items-center justify-end gap-2'>
                <span className='text-sm text-muted-foreground'>{t(`config.general.accents.${selected}`)}</span>
                <div
                    role='radiogroup'
                    aria-label={t('config.general.app_accent')}
                    className='flex items-center gap-1'
                    {...props}
                >
                    {accents.map((accent) => (
                        <Tooltip key={accent.value}>
                            <TooltipTrigger asChild>
                                <Button
                                    type='button'
                                    role='radio'
                                    variant='ghost'
                                    aria-label={t(`config.general.accents.${accent.value}`)}
                                    aria-checked={selected === accent.value}
                                    tabIndex={selected === accent.value ? 0 : -1}
                                    ref={(element) => {
                                        buttons.current[accent.value] = element;
                                    }}
                                    className={cn(
                                        'size-7 rounded-full border-2 border-transparent p-0 hover:bg-transparent',
                                        selected === accent.value && 'border-foreground'
                                    )}
                                    onClick={() => onChange(accent.value)}
                                    onKeyDown={(event) => {
                                        const next = accentFromKey(accent.value, event.key);
                                        if (next === null) return;
                                        event.preventDefault();
                                        onChange(next);
                                        buttons.current[next]?.focus();
                                    }}
                                >
                                    <span
                                        className='size-5 rounded-full border border-border bg-origin-border bg-no-repeat'
                                        aria-hidden='true'
                                        style={{
                                            // A repeating gradient can wrap its right color into the left border at 125%.
                                            backgroundColor: accent.swatch[0],
                                            backgroundImage:
                                                accent.swatch.length === 2
                                                    ? `linear-gradient(to right, ${accent.swatch[0]} 50%, ${accent.swatch[1]} 50%)`
                                                    : 'none',
                                        }}
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t(`config.general.accents.${accent.value}`)}</TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    );
}
