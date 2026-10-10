import React from 'react';

import WindowControl from '../WindowControl';
import WindowDragRegion from './WindowDragRegion';
import { osType } from '../../utils/env';

// 52px header (+1px bottom border, so the 32px window buttons sit on whole pixels): page title on the left, window controls on the right (hidden on macOS). The bar drags the window, except within 5px of the window edges (resize border).
export default function PageHeader({ title }) {
    return (
        <header className='relative isolate flex h-[calc(3.25rem+1px)] shrink-0 items-center justify-between border-b pl-6 pr-2'>
            <WindowDragRegion />
            <h2 className='pointer-events-none truncate text-base font-semibold'>{title}</h2>
            {osType !== 'Darwin' && <WindowControl />}
        </header>
    );
}
