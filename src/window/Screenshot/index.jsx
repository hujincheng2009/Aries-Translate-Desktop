import React, { useEffect, useState, useRef } from 'react';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { currentMonitor } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { warn } from 'tauri-plugin-log-api';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api';

import { cn } from '@/lib/utils';

export default function Screenshot() {
    const [imgurl, setImgurl] = useState('');
    const [isMoved, setIsMoved] = useState(false);
    const [isDown, setIsDown] = useState(false);
    const [mouseDownX, setMouseDownX] = useState(0);
    const [mouseDownY, setMouseDownY] = useState(0);
    const [mouseMoveX, setMouseMoveX] = useState(0);
    const [mouseMoveY, setMouseMoveY] = useState(0);

    const imgRef = useRef();
    const { t } = useTranslation();

    useEffect(() => {
        currentMonitor().then((monitor) => {
            const position = monitor.position;
            invoke('screenshot', { x: position.x, y: position.y }).then(() => {
                appCacheDir().then((appCacheDirPath) => {
                    join(appCacheDirPath, 'aries_screenshot.png').then((filePath) => {
                        setImgurl(convertFileSrc(filePath));
                    });
                });
            });
        });
    }, []);

    // Selection size in physical pixels, computed the same way as the crop in onMouseUp below.
    const labelDpi = (imgRef.current?.naturalWidth || screen.width) / screen.width;
    const selectionWidth =
        Math.floor(Math.max(mouseDownX, mouseMoveX) * labelDpi) -
        Math.floor(Math.min(mouseDownX, mouseMoveX) * labelDpi);
    const selectionHeight =
        Math.floor(Math.max(mouseDownY, mouseMoveY) * labelDpi) -
        Math.floor(Math.min(mouseDownY, mouseMoveY) * labelDpi);

    return (
        <>
            <img
                ref={imgRef}
                className='fixed top-0 left-0 w-full select-none'
                src={imgurl}
                draggable={false}
                onLoad={() => {
                    if (imgurl !== '' && imgRef.current.complete) {
                        void appWindow.show();
                        void appWindow.setFocus();
                        void appWindow.setResizable(false);
                    }
                }}
            />
            <div
                className={cn(
                    'fixed border border-solid border-sky-500 bg-[#2080f020] shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]',
                    !isMoved && 'hidden'
                )}
                style={{
                    top: Math.min(mouseDownY, mouseMoveY),
                    left: Math.min(mouseDownX, mouseMoveX),
                    bottom: screen.height - Math.max(mouseDownY, mouseMoveY),
                    right: screen.width - Math.max(mouseDownX, mouseMoveX),
                }}
            >
                <span className='pointer-events-none absolute -left-[3px] -top-[3px] size-1.5 bg-white' />
                <span className='pointer-events-none absolute -right-[3px] -top-[3px] size-1.5 bg-white' />
                <span className='pointer-events-none absolute -bottom-[3px] -left-[3px] size-1.5 bg-white' />
                <span className='pointer-events-none absolute -bottom-[3px] -right-[3px] size-1.5 bg-white' />
                <span
                    className={cn(
                        'pointer-events-none absolute left-0 select-none whitespace-nowrap rounded-md bg-black/75 px-2 py-1 text-xs tabular-nums text-white',
                        Math.min(mouseDownY, mouseMoveY) < 36 ? 'top-1 left-1' : '-top-8'
                    )}
                >
                    {selectionWidth} × {selectionHeight}
                </span>
            </div>
            <div className='pointer-events-none fixed left-1/2 top-4 -translate-x-1/2 select-none whitespace-nowrap rounded-md bg-black/75 px-3 py-1.5 text-xs text-white'>
                {t('screenshot.hint')}
            </div>
            <div
                className='fixed top-0 left-0 bottom-0 right-0 cursor-crosshair select-none'
                onMouseDown={(e) => {
                    if (e.buttons === 1) {
                        setIsDown(true);
                        setMouseDownX(e.clientX);
                        setMouseDownY(e.clientY);
                    } else {
                        void appWindow.close();
                    }
                }}
                onMouseMove={(e) => {
                    if (isDown) {
                        setIsMoved(true);
                        setMouseMoveX(e.clientX);
                        setMouseMoveY(e.clientY);
                    }
                }}
                onMouseUp={async (e) => {
                    appWindow.hide();
                    setIsDown(false);
                    setIsMoved(false);
                    const imgWidth = imgRef.current.naturalWidth;
                    const dpi = imgWidth / screen.width;
                    const left = Math.floor(Math.min(mouseDownX, e.clientX) * dpi);
                    const top = Math.floor(Math.min(mouseDownY, e.clientY) * dpi);
                    const right = Math.floor(Math.max(mouseDownX, e.clientX) * dpi);
                    const bottom = Math.floor(Math.max(mouseDownY, e.clientY) * dpi);
                    const width = right - left;
                    const height = bottom - top;
                    if (width <= 0 || height <= 0) {
                        warn('Screenshot area is too small');
                        await appWindow.close();
                    } else {
                        await invoke('cut_image', { left, top, width, height });
                        await emit('success');
                        await appWindow.close();
                    }
                }}
            />
        </>
    );
}
