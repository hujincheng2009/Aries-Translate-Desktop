import React from 'react';

import { cn } from '@/lib/utils';

// Invisible drag layer for a title bar. Put it first inside a `relative isolate` bar: it sits behind the bar's
// buttons (which stay clickable) and stops 5px short of the top and side edges, so the window's resize border
// there keeps working. A drag region that reaches the edge fights the resize cursor and blocks resizing.
// Text inside the bar should be `pointer-events-none` so presses on it reach this layer.
export default function WindowDragRegion({ className }) {
    return (
        <div
            data-tauri-drag-region='true'
            className={cn('absolute inset-x-[5px] bottom-0 top-[5px] -z-10', className)}
        />
    );
}
