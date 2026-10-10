import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground',
                secondary: 'bg-secondary text-secondary-foreground',
                outline: 'border-border text-foreground',
                destructive: 'bg-destructive/10 text-destructive',
                ghost: 'text-foreground hover:bg-accent',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

function Badge({ className, variant, asChild = false, ...props }) {
    const Comp = asChild ? Slot : 'span';
    return (
        <Comp
            data-slot='badge'
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
