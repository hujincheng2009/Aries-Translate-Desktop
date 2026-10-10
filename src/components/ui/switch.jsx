import * as SwitchPrimitive from '@radix-ui/react-switch';
import React from 'react';

import { cn } from '@/lib/utils';

// Vega switch: 32 × 18px track with a 16px thumb.
// The thumb is painted as a background of the track (`.ui-switch` in style.css), not as a separate element:
// a background is placed relative to the track's own pixel-snapped box, so the thumb stays exactly centered
// at any display scaling (e.g. 125%) and app font size, where a positioned thumb would round unevenly.
const Switch = React.forwardRef(({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
        ref={ref}
        data-slot='switch'
        className={cn(
            'ui-switch peer inline-flex h-[18px] w-[32px] shrink-0 rounded-full shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-vivid data-[state=unchecked]:bg-switch-track',
            className
        )}
        {...props}
    />
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
