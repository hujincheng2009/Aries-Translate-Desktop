import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { Copy, GripVertical, Languages, Plus, Replace, Trash2, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/tauri';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import SettingsSection from '../../../../components/app/SettingsSection';
import SettingRow from '../../../../components/app/SettingRow';
import OptionSelect from '../../../../components/app/OptionSelect';
import { useConfig } from '../../../../hooks/useConfig';
import {
    HIDE_DELAY_OPTIONS,
    SELECTION_DEFAULTS,
    addToBlacklist,
    clampOffset,
    moveItem,
    normalizeActions,
    normalizeOrder,
    toggleAction,
} from '../../../../utils/selection_assistant';
import { cn } from '@/lib/utils';
import SelectionPreview from './Preview';

const ACTION_ICONS = {
    translate: Languages,
    replace_translate: Replace,
    copy: Copy,
    read_aloud: Volume2,
};

// A config value that is saved by useConfig and pushed to the running assistant at the same time.
function useSelectionConfig(key) {
    const [value, setValue] = useConfig(key, SELECTION_DEFAULTS[key]);
    const update = (next) => {
        setValue(next);
        invoke('selection_assistant_set', { key, value: next });
    };
    return [value, update];
}

function OffsetInput({ label, value, onCommit }) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    const commit = () => {
        const next = clampOffset(draft, value);
        setDraft(String(next));
        if (next !== value) onCommit(next);
    };
    return (
        <label className='flex items-center gap-2 text-sm'>
            <span>{label}</span>
            <Input
                inputMode='numeric'
                aria-label={label}
                className='w-16'
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                }}
            />
        </label>
    );
}

function AddAppDialog({ open, onOpenChange, onAdd, existing }) {
    const { t } = useTranslation();
    const [apps, setApps] = useState(null);
    const [manual, setManual] = useState('');

    useEffect(() => {
        if (!open) return;
        setManual('');
        setApps(null);
        invoke('selection_assistant_running_apps').then((list) => setApps(list ?? []));
    }, [open]);

    const taken = (exe) => existing.some((item) => item.toLowerCase() === exe.toLowerCase());

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className='grid-cols-[minmax(0,1fr)] sm:max-w-[30rem]'>
                <DialogHeader>
                    <DialogTitle>{t('config.selection.add_app')}</DialogTitle>
                    <DialogDescription>{t('config.selection.add_app_desc')}</DialogDescription>
                </DialogHeader>
                <div className='-mx-1 flex max-h-[min(18rem,calc(100vh-18rem))] flex-col overflow-y-auto px-1'>
                    {apps === null && (
                        <div className='py-6 text-center text-sm text-muted-foreground'>
                            {t('config.selection.loading_apps')}
                        </div>
                    )}
                    {apps?.length === 0 && (
                        <div className='py-6 text-center text-sm text-muted-foreground'>
                            {t('config.selection.no_apps')}
                        </div>
                    )}
                    {apps?.map((app) => (
                        <button
                            key={app.exe}
                            type='button'
                            disabled={taken(app.exe)}
                            onClick={() => {
                                onAdd(app.exe);
                                onOpenChange(false);
                            }}
                            className='flex min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
                        >
                            <span className='max-w-full truncate text-sm font-medium'>{app.exe}</span>
                            <span className='max-w-full truncate text-sm text-muted-foreground'>{app.title}</span>
                        </button>
                    ))}
                </div>
                <form
                    className='flex gap-2'
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (manual.trim() === '') return;
                        onAdd(manual);
                        onOpenChange(false);
                    }}
                >
                    <Input
                        value={manual}
                        placeholder={t('config.selection.manual_placeholder')}
                        aria-label={t('config.selection.manual_placeholder')}
                        onChange={(e) => setManual(e.target.value)}
                    />
                    <Button
                        type='submit'
                        variant='outline'
                        disabled={manual.trim() === ''}
                    >
                        {t('config.selection.add')}
                    </Button>
                </form>
                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                    >
                        {t('common.cancel')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function SelectionAssistant() {
    const { t } = useTranslation();
    const [enable, setEnable] = useSelectionConfig('selection_assistant_enable');
    const [displayMode, setDisplayMode] = useSelectionConfig('selection_assistant_display_mode');
    const [buttonStyle, setButtonStyle] = useSelectionConfig('selection_assistant_button_style');
    const [showLogo, setShowLogo] = useSelectionConfig('selection_assistant_show_logo');
    const [offsetX, setOffsetX] = useSelectionConfig('selection_assistant_offset_x');
    const [offsetY, setOffsetY] = useSelectionConfig('selection_assistant_offset_y');
    const [hideDelay, setHideDelay] = useSelectionConfig('selection_assistant_hide_delay');
    const [disableInFullscreen, setDisableInFullscreen] = useSelectionConfig(
        'selection_assistant_disable_in_fullscreen'
    );
    const [compatMode, setCompatMode] = useSelectionConfig('selection_assistant_compat_mode');
    const [actions, setActions] = useSelectionConfig('selection_assistant_actions');
    const [blacklist, setBlacklist] = useSelectionConfig('selection_assistant_blacklist');
    const [actionOrder, setActionOrder] = useConfig(
        'selection_assistant_action_order',
        SELECTION_DEFAULTS.selection_assistant_action_order
    );
    const [addOpen, setAddOpen] = useState(false);

    const order = normalizeOrder(actionOrder, actions);
    const enabled = normalizeActions(actions);
    const list = Array.isArray(blacklist) ? blacklist : [];

    const option = (prefix) => (key) => ({ value: key, label: t(`config.selection.${prefix}_${key}`) });
    const hideDelayLabel = (seconds) =>
        seconds === 0 ? t('config.selection.never') : t('config.selection.seconds', { count: seconds });

    return (
        <>
            <SettingsSection
                title={t('config.selection.section.basic')}
                description={t('config.selection.section.basic_desc')}
                lead={
                    displayMode !== null &&
                    buttonStyle !== null &&
                    offsetX !== null &&
                    offsetY !== null &&
                    hideDelay !== null && (
                        <SelectionPreview
                            enabled={enable === true}
                            displayMode={displayMode}
                            buttonStyle={buttonStyle}
                            showLogo={showLogo !== false}
                            offsetX={offsetX}
                            offsetY={offsetY}
                            hideDelay={hideDelay}
                            actions={enabled}
                        />
                    )
                }
            >
                <SettingRow
                    title={t('config.selection.enable')}
                    description={t('config.selection.enable_desc')}
                >
                    <Switch
                        checked={enable === true}
                        onCheckedChange={setEnable}
                    />
                </SettingRow>
                <SettingRow
                    title={t('config.selection.display_mode')}
                    description={t('config.selection.display_mode_desc')}
                >
                    {displayMode !== null && (
                        <OptionSelect
                            ariaLabel={t('config.selection.display_mode')}
                            value={displayMode}
                            label={t(`config.selection.display_mode_${displayMode}`)}
                            options={['icon', 'toolbar'].map(option('display_mode'))}
                            onChange={setDisplayMode}
                        />
                    )}
                </SettingRow>
                <SettingRow
                    title={t('config.selection.button_style')}
                    description={t('config.selection.button_style_desc')}
                >
                    {buttonStyle !== null && (
                        <OptionSelect
                            ariaLabel={t('config.selection.button_style')}
                            value={buttonStyle}
                            label={t(`config.selection.button_style_${buttonStyle}`)}
                            options={['icon', 'icon_text'].map(option('button_style'))}
                            onChange={setButtonStyle}
                        />
                    )}
                </SettingRow>
                <SettingRow
                    title={t('config.selection.show_logo')}
                    description={t('config.selection.show_logo_desc')}
                >
                    <Switch
                        checked={showLogo === true}
                        onCheckedChange={setShowLogo}
                    />
                </SettingRow>
                <SettingRow
                    title={t('config.selection.offset')}
                    description={t('config.selection.offset_desc')}
                >
                    {offsetX !== null && offsetY !== null && (
                        <div className='flex items-center gap-3'>
                            <OffsetInput
                                label='X'
                                value={offsetX}
                                onCommit={setOffsetX}
                            />
                            <OffsetInput
                                label='Y'
                                value={offsetY}
                                onCommit={setOffsetY}
                            />
                            <span className='text-sm text-muted-foreground'>px</span>
                        </div>
                    )}
                </SettingRow>
                <SettingRow
                    title={t('config.selection.hide_delay')}
                    description={t('config.selection.hide_delay_desc')}
                >
                    {hideDelay !== null && (
                        <OptionSelect
                            ariaLabel={t('config.selection.hide_delay')}
                            value={String(hideDelay)}
                            label={hideDelayLabel(hideDelay)}
                            options={HIDE_DELAY_OPTIONS.map((seconds) => ({
                                value: String(seconds),
                                label: hideDelayLabel(seconds),
                            }))}
                            onChange={(value) => setHideDelay(Number(value))}
                        />
                    )}
                </SettingRow>
            </SettingsSection>

            <SettingsSection
                title={t('config.selection.section.actions')}
                description={t('config.selection.section.actions_desc')}
            >
                <DragDropContext
                    onDragEnd={(result) => {
                        if (!result.destination) return;
                        const next = moveItem(order, result.source.index, result.destination.index);
                        setActionOrder(next);
                        setActions(next.filter((item) => enabled.includes(item)));
                    }}
                >
                    <Droppable droppableId='selection-actions'>
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {order.map((action, index) => {
                                    const Icon = ACTION_ICONS[action];
                                    const checked = enabled.includes(action);
                                    return (
                                        <Draggable
                                            key={action}
                                            draggableId={action}
                                            index={index}
                                        >
                                            {(dragProvided, snapshot) => (
                                                <div
                                                    ref={dragProvided.innerRef}
                                                    {...dragProvided.draggableProps}
                                                    className={cn(
                                                        'flex items-center gap-3 border-b bg-card px-4 py-3.5 last:border-b-0',
                                                        snapshot.isDragging && 'rounded-md border shadow-md'
                                                    )}
                                                >
                                                    <span
                                                        {...dragProvided.dragHandleProps}
                                                        aria-label={t('config.selection.drag')}
                                                        className='flex text-muted-foreground'
                                                    >
                                                        <GripVertical className='size-4' />
                                                    </span>
                                                    <Checkbox
                                                        checked={checked}
                                                        aria-label={t(`selection_bar.${action}`)}
                                                        onCheckedChange={(value) => {
                                                            const next = toggleAction(
                                                                order,
                                                                enabled,
                                                                action,
                                                                value === true
                                                            );
                                                            if (next) setActions(next);
                                                        }}
                                                    />
                                                    <Icon className='size-4 shrink-0' />
                                                    <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                                                        <div className='text-sm font-medium leading-5'>
                                                            {t(`selection_bar.${action}`)}
                                                        </div>
                                                        <div className='text-sm leading-5 text-muted-foreground'>
                                                            {t(`config.selection.action_desc_${action}`)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </SettingsSection>

            <SettingsSection
                title={t('config.selection.section.conditions')}
                description={t('config.selection.section.conditions_desc')}
            >
                <SettingRow
                    title={t('config.selection.disable_in_fullscreen')}
                    description={t('config.selection.disable_in_fullscreen_desc')}
                >
                    <Switch
                        checked={disableInFullscreen === true}
                        onCheckedChange={setDisableInFullscreen}
                    />
                </SettingRow>
                <SettingRow
                    title={t('config.selection.compat_mode')}
                    description={t('config.selection.compat_mode_desc')}
                >
                    <Switch
                        checked={compatMode === true}
                        onCheckedChange={setCompatMode}
                    />
                </SettingRow>
            </SettingsSection>

            <SettingsSection
                title={t('config.selection.section.blacklist')}
                description={t('config.selection.section.blacklist_desc')}
            >
                {list.map((exe) => (
                    <SettingRow
                        key={exe}
                        title={exe}
                    >
                        <Button
                            variant='ghost'
                            size='icon-sm'
                            aria-label={t('common.delete')}
                            onClick={() => setBlacklist(list.filter((item) => item !== exe))}
                        >
                            <Trash2 />
                        </Button>
                    </SettingRow>
                ))}
                <div className='flex flex-wrap items-center gap-2 px-4 py-3'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setAddOpen(true)}
                    >
                        <Plus />
                        {t('config.selection.add_app')}
                    </Button>
                    <span className='text-sm text-muted-foreground'>{t('config.selection.add_app_hint')}</span>
                </div>
            </SettingsSection>

            <AddAppDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                existing={list}
                onAdd={(exe) => setBlacklist(addToBlacklist(list, exe))}
            />
        </>
    );
}
