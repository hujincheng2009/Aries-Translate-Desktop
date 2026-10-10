import React from 'react';

import { cn } from '@/lib/utils';

// Vega: 14px radius, 24px padding (16px for size="sm"), footer without background or divider
const Card = React.forwardRef(({ className, size = 'default', ...props }, ref) => (
    <div
        ref={ref}
        data-slot='card'
        data-size={size}
        className={cn(
            'group/card flex flex-col gap-6 overflow-hidden rounded-xl border bg-card py-6 text-card-foreground shadow-xs data-[size=sm]:gap-4 data-[size=sm]:py-4',
            className
        )}
        {...props}
    />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-slot='card-header'
        className={cn('grid auto-rows-min items-start gap-1 px-6 group-data-[size=sm]/card:px-4', className)}
        {...props}
    />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-slot='card-title'
        className={cn('text-base font-medium leading-normal', className)}
        {...props}
    />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-slot='card-description'
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
    />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-slot='card-content'
        className={cn('px-6 group-data-[size=sm]/card:px-4', className)}
        {...props}
    />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-slot='card-footer'
        className={cn('flex items-center px-6 group-data-[size=sm]/card:px-4', className)}
        {...props}
    />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
