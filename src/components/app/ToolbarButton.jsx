import React from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Small ghost icon button with a tooltip, used in the card toolbars of the translate and recognize windows.
// `label` is both the tooltip text and the accessible name. Needs a TooltipProvider higher up.
const ToolbarButton = React.forwardRef(({ label, active = false, className, children, ...props }, ref) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <Button
                ref={ref}
                variant='ghost'
                size='icon-sm'
                aria-label={label}
                className={cn('text-muted-foreground hover:text-foreground', active && 'text-foreground', className)}
                {...props}
            >
                {children}
            </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
    </Tooltip>
));
ToolbarButton.displayName = 'ToolbarButton';

export default ToolbarButton;
