import React from 'react';

import { cn } from '@/lib/utils';

function Kbd({ className, ...props }) {
    return (
        <kbd
            data-slot='kbd'
            className={cn(
                "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-[4px] bg-muted px-1 font-sans text-xs font-medium text-muted-foreground [&_svg:not([class*='size-'])]:size-3",
                className
            )}
            {...props}
        />
    );
}

function KbdGroup({ className, ...props }) {
    return (
        <kbd
            data-slot='kbd-group'
            className={cn('inline-flex items-center gap-1', className)}
            {...props}
        />
    );
}

export { Kbd, KbdGroup };
