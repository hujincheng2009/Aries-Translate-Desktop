import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/lib/utils';

// Vega: sm 32px / default 36px / lg 40px, 10px horizontal padding, 8px radius, 16px icons
const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
                destructive:
                    'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20',
                outline:
                    'border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
                link: 'text-primary-text underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-9 px-2.5',
                xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
                sm: 'h-8 gap-1 px-2.5',
                lg: 'h-10 px-2.5',
                icon: 'size-9',
                'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
                'icon-sm': 'size-8',
                'icon-lg': 'size-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
        <Comp
            ref={ref}
            data-slot='button'
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
