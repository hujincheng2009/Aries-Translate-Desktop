import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React, { useEffect } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ToolbarButton from '../../../../components/app/ToolbarButton';

import { languageList } from '../../../../utils/language';
import { detectLanguageAtom } from '../SourceArea';
import { useConfig } from '../../../../hooks';

export const sourceLanguageAtom = atom();
export const targetLanguageAtom = atom();

export default function LanguageArea() {
    const [rememberLanguage] = useConfig('translate_remember_language', false);
    const [translateSourceLanguage, setTranslateSourceLanguage] = useConfig('translate_source_language', 'auto');
    const [translateTargetLanguage, setTranslateTargetLanguage] = useConfig('translate_target_language', 'zh_cn');
    const [translateSecondLanguage] = useConfig('translate_second_language', 'en');

    const [sourceLanguage, setSourceLanguage] = useAtom(sourceLanguageAtom);
    const [targetLanguage, setTargetLanguage] = useAtom(targetLanguageAtom);
    const detectLanguage = useAtomValue(detectLanguageAtom);
    const { t } = useTranslation();

    useEffect(() => {
        if (translateSourceLanguage) {
            setSourceLanguage(translateSourceLanguage);
        }
        if (translateTargetLanguage) {
            setTargetLanguage(translateTargetLanguage);
        }
    }, [translateSourceLanguage, translateTargetLanguage]);

    useEffect(() => {
        if (rememberLanguage !== null && rememberLanguage) {
            setTranslateSourceLanguage(sourceLanguage);
            setTranslateTargetLanguage(targetLanguage);
        }
    }, [sourceLanguage, targetLanguage, rememberLanguage]);

    const swapLanguage = () => {
        if (sourceLanguage !== 'auto') {
            const oldSourceLanguage = sourceLanguage;
            setSourceLanguage(targetLanguage);
            setTargetLanguage(oldSourceLanguage);
        } else {
            if (detectLanguage !== '' && detectLanguage !== 'auto') {
                if (targetLanguage === translateTargetLanguage) {
                    setTargetLanguage(detectLanguage);
                } else {
                    setTargetLanguage(translateTargetLanguage);
                }
            } else {
                if (targetLanguage === translateSecondLanguage) {
                    setTargetLanguage(translateTargetLanguage);
                } else {
                    setTargetLanguage(translateSecondLanguage);
                }
            }
        }
    };

    return (
        <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 rounded-xl border bg-card p-1 text-card-foreground'>
            <LanguageMenu
                label={t('translate.source_language')}
                value={sourceLanguage}
                languages={['auto', ...languageList]}
                onChange={setSourceLanguage}
            />
            <ToolbarButton
                label={t('translate.swap_language')}
                onClick={swapLanguage}
            >
                <ArrowLeftRight />
            </ToolbarButton>
            <LanguageMenu
                label={t('translate.target_language')}
                value={targetLanguage}
                languages={languageList}
                onChange={setTargetLanguage}
            />
        </div>
    );
}

function LanguageMenu({ label, value, languages, onChange }) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant='ghost'
                    aria-label={label}
                    className='w-full min-w-0'
                >
                    <span className='truncate'>{t(`languages.${value}`)}</span>
                    <ChevronDown className='text-muted-foreground' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                aria-label={label}
                className='max-h-[min(50vh,var(--radix-dropdown-menu-content-available-height))]'
            >
                <DropdownMenuRadioGroup
                    value={value}
                    onValueChange={onChange}
                >
                    {languages.map((x) => (
                        <DropdownMenuRadioItem
                            key={x}
                            value={x}
                        >
                            {t(`languages.${x}`)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
