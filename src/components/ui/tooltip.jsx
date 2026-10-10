import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import React from 'react';

import { cn } from '@/lib/utils';

function TooltipProvider({ delayDuration = 300, ...props }) {
    return (
        <TooltipPrimitive.Provider
            delayDuration={delayDuration}
            {...props}
        />
    );
}

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, children, ...props }, ref) => (
    <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
            ref={ref}
            data-slot='tooltip-content'
            sideOffset={sideOffset}
            className={cn(
                'z-50 w-fit origin-[--radix-tooltip-content-transform-origin] text-balance rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                className
            )}
            {...props}
        >
            {children}
        </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
