import { cva } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
    'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(1rem)_1fr] has-[>svg]:gap-x-2.5 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
    {
        variants: {
            variant: {
                default: 'bg-card text-card-foreground',
                destructive:
                    'bg-card text-destructive [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90',
                warning: 'border-warning-border bg-warning text-warning-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

function Alert({ className, variant, ...props }) {
    return (
        <div
            data-slot='alert'
            role='alert'
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }) {
    return (
        <div
            data-slot='alert-title'
            className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
            {...props}
        />
    );
}

function AlertDescription({ className, ...props }) {
    return (
        <div
            data-slot='alert-description'
            className={cn('col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed', className)}
            {...props}
        />
    );
}

export { Alert, AlertDescription, AlertTitle };
