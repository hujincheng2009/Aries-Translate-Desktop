import { useRoutes } from 'react-router-dom';
import React, { useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';

import ConfigShell from '../../components/app/ConfigShell';
import routes from './routes';

export default function Config() {
    const page = useRoutes(routes);

    useEffect(() => {
        if (appWindow.label === 'config') {
            appWindow.show();
        }
    }, []);

    return <ConfigShell>{page}</ConfigShell>;
}
