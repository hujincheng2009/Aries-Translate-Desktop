// Small display components that are a few lines each: Separator, Skeleton, Spinner, Progress, Slider, ScrollArea.
import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Loader2Icon } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

const Separator = React.forwardRef(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <SeparatorPrimitive.Root
        ref={ref}
        data-slot='separator'
        decorative={decorative}
        orientation={orientation}
        className={cn(
            'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px',
            className
        )}
        {...props}
    />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

function Skeleton({ className, ...props }) {
    return (
        <div
            data-slot='skeleton'
            className={cn('animate-pulse rounded-md bg-accent', className)}
            {...props}
        />
    );
}

function Spinner({ className, ...props }) {
    return (
        <Loader2Icon
            role='status'
            aria-label='Loading'
            className={cn('size-4 animate-spin', className)}
            {...props}
        />
    );
}

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        data-slot='progress'
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className='h-full w-full flex-1 bg-primary transition-all'
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

const Slider = React.forwardRef(({ className, 'aria-label': ariaLabel, ...props }, ref) => (
    <SliderPrimitive.Root
        ref={ref}
        data-slot='slider'
        aria-label={ariaLabel}
        className={cn('relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50', className)}
        {...props}
    >
        <SliderPrimitive.Track className='relative h-1 w-full grow overflow-hidden rounded-full bg-muted'>
            <SliderPrimitive.Range className='absolute h-full bg-primary-vivid' />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
            aria-label={ariaLabel}
            className='block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none transition-[color,box-shadow] hover:ring-4 hover:ring-ring/50 focus-visible:ring-4 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
        />
    </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
    <ScrollAreaPrimitive.Root
        ref={ref}
        data-slot='scroll-area'
        className={cn('relative overflow-hidden', className)}
        {...props}
    >
        <ScrollAreaPrimitive.Viewport className='size-full rounded-[inherit]'>{children}</ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef(({ className, orientation = 'vertical', ...props }, ref) => (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
        ref={ref}
        orientation={orientation}
        className={cn(
            'flex touch-none select-none p-px transition-colors',
            orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
            orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
            className
        )}
        {...props}
    >
        <ScrollAreaPrimitive.ScrollAreaThumb className='relative flex-1 rounded-full bg-border' />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { Progress, ScrollArea, ScrollBar, Separator, Skeleton, Slider, Spinner };
