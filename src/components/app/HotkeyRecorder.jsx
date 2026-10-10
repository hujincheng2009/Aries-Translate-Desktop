import { X } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

// Hotkey capture field.
//  - focusing the field calls `onFocus` (the page clears and unregisters the old shortcut)
//  - key presses are forwarded to `onKeyDown` (the page turns them into a "Ctrl+Alt+Q" style string)
//  - after a combination was typed it is "pending": a small confirm button is shown and `onConfirm` registers it
//  - otherwise, when a value exists, a clear button calls `onClear`
// `onConfirm` may return a promise resolving to true when registration succeeded; the field then leaves "pending".
export default function HotkeyRecorder({
    value,
    placeholder,
    confirmLabel,
    clearLabel,
    onKeyDown,
    onFocus,
    onConfirm,
    onClear,
    className,
    'aria-labelledby': labelledBy,
}) {
    const [pending, setPending] = useState(false);
    const keys = value ? value.split('+') : [];
    const showConfirm = pending && keys.length > 0;

    return (
        <div className={cn('relative w-60 max-w-full', className)}>
            <div
                role='textbox'
                aria-readonly='true'
                aria-label={placeholder}
                aria-labelledby={labelledBy}
                tabIndex={0}
                onKeyDown={(e) => {
                    onKeyDown(e);
                    // Backspace clears the value; any other key records a new, not yet registered combination.
                    setPending(e.keyCode !== 8);
                }}
                onFocus={() => {
                    setPending(false);
                    onFocus();
                }}
                className='flex h-9 w-full cursor-text items-center gap-1 overflow-hidden rounded-md border border-input bg-background pl-2.5 pr-14 text-sm shadow-xs outline-none transition-[color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/50 dark:bg-input/30'
            >
                {keys.length === 0 ? (
                    <span className='truncate text-muted-foreground'>{placeholder}</span>
                ) : (
                    keys.map((key, index) => <Kbd key={`${key}-${index}`}>{key}</Kbd>)
                )}
            </div>
            {showConfirm && (
                <Button
                    type='button'
                    size='xs'
                    variant='outline'
                    className='absolute right-1.5 top-1/2 -translate-y-1/2'
                    onClick={() => {
                        Promise.resolve(onConfirm()).then((ok) => {
                            if (ok) {
                                setPending(false);
                            }
                        });
                    }}
                >
                    {confirmLabel}
                </Button>
            )}
            {!showConfirm && keys.length > 0 && (
                <Button
                    type='button'
                    size='icon-xs'
                    variant='ghost'
                    aria-label={clearLabel}
                    className='absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                    onClick={() => {
                        setPending(false);
                        onClear();
                    }}
                >
                    <X />
                </Button>
            )}
        </div>
    );
}
