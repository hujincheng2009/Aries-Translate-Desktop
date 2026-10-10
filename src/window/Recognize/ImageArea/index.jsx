import { appWindow } from '@tauri-apps/api/window';
import React, { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api';
import { atom, useAtom } from 'jotai';

import ToolbarButton from '../../../components/app/ToolbarButton';
import { useConfig } from '../../../hooks';

export const base64Atom = atom('');
let unlisten = null;

export default function ImageArea() {
    const [hideWindow] = useConfig('recognize_hide_window', false);
    const [base64, setBase64] = useAtom(base64Atom);
    const imgRef = useRef();
    const { t } = useTranslation();
    const load_img = () => {
        invoke('get_base64').then((v) => {
            setBase64(v);
            if (hideWindow) {
                appWindow.hide();
            } else {
                appWindow.show();
                appWindow.setFocus(true);
            }
        });
    };

    useEffect(() => {
        if (hideWindow !== null) {
            load_img();
            if (unlisten) {
                unlisten.then((f) => {
                    f();
                });
            }
            unlisten = listen('new_image', (_) => {
                load_img();
            });
        }
    }, [hideWindow]);

    return (
        <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs'>
            <div className='relative min-h-0 flex-1'>
                {base64 !== '' && (
                    <img
                        ref={imgRef}
                        draggable={false}
                        className='absolute inset-0 size-full object-contain p-2'
                        src={'data:image/png;base64,' + base64}
                    />
                )}
            </div>
            <div className='flex items-center justify-start border-t p-2'>
                <ToolbarButton
                    label={t('recognize.copy_img')}
                    onClick={async () => {
                        await invoke('copy_img', {
                            width: imgRef.current.naturalWidth,
                            height: imgRef.current.naturalHeight,
                        });
                    }}
                >
                    <Copy />
                </ToolbarButton>
            </div>
        </div>
    );
}
