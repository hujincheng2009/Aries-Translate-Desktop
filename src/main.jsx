import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { appWindow } from '@tauri-apps/api/window';
import ReactDOM from 'react-dom/client';
import React from 'react';

import { initStore } from './utils/store';
import { initEnv } from './utils/env';
import App from './App';

if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

initStore().then(async () => {
    await initEnv();
    const rootElement = document.getElementById('root');
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <NextThemesProvider attribute='class'>
            <App />
        </NextThemesProvider>
    );
});
