import * as TabsPrimitive from '@radix-ui/react-tabs';
import React from 'react';

import { cn } from '@/lib/utils';

const Tabs = React.forwardRef(({ className, ...props }, ref) => (
    <TabsPrimitive.Root
        ref={ref}
        data-slot='tabs'
        className={cn('flex flex-col gap-2', className)}
        {...props}
    />
));
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        data-slot='tabs-list'
        className={cn(
            'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground',
            className
        )}
        {...props}
    />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        data-slot='tabs-trigger'
        className={cn(
            "inline-flex h-full flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 text-sm font-medium text-muted-foreground outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className
        )}
        {...props}
    />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        data-slot='tabs-content'
        className={cn('flex-1 outline-none', className)}
        {...props}
    />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
