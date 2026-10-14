// Helpers for the selection assistant settings page and toolbar (划词助手, 1.1.0).
// `selection_assistant_actions` holds the enabled buttons in display order (read by the Rust side);
// `selection_assistant_action_order` keeps the order of every button, so unchecking one does not move it.

export const SELECTION_ACTIONS = ['translate', 'replace_translate', 'copy', 'read_aloud'];

export const SELECTION_DEFAULTS = {
    selection_assistant_enable: false,
    selection_assistant_display_mode: 'icon',
    selection_assistant_button_style: 'icon',
    selection_assistant_show_logo: true,
    selection_assistant_hide_delay: 3,
    selection_assistant_offset_x: 12,
    selection_assistant_offset_y: 16,
    selection_assistant_disable_in_fullscreen: true,
    selection_assistant_compat_mode: true,
    selection_assistant_actions: SELECTION_ACTIONS,
    selection_assistant_action_order: SELECTION_ACTIONS,
    selection_assistant_blacklist: [],
};

// Seconds; 0 = never hide on a timer.
export const HIDE_DELAY_OPTIONS = [2, 3, 5, 8, 0];
export const OFFSET_LIMIT = 200;

function uniqueKnown(list) {
    const result = [];
    if (!Array.isArray(list)) return result;
    for (const item of list) {
        if (SELECTION_ACTIONS.includes(item) && !result.includes(item)) result.push(item);
    }
    return result;
}

// Enabled actions in order; an empty or invalid list falls back to all actions (same rule as the Rust side).
export function normalizeActions(actions) {
    const result = uniqueKnown(actions);
    return result.length > 0 ? result : [...SELECTION_ACTIONS];
}

// Every action exactly once: the saved order first, then enabled actions it lacks, then the rest.
export function normalizeOrder(order, actions) {
    const result = uniqueKnown(order);
    for (const action of [...uniqueKnown(actions), ...SELECTION_ACTIONS]) {
        if (!result.includes(action)) result.push(action);
    }
    return result;
}

// New enabled list after checking / unchecking one action, or null when that would leave no button.
export function toggleAction(order, actions, action, checked) {
    const enabled = new Set(normalizeActions(actions));
    if (checked) enabled.add(action);
    else enabled.delete(action);
    const result = normalizeOrder(order, actions).filter((item) => enabled.has(item));
    return result.length > 0 ? result : null;
}

export function moveItem(list, from, to) {
    const result = [...list];
    if (from < 0 || from >= result.length || to < 0 || to >= result.length) return result;
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
}

// "C:\\Program Files\\Foo\\Foo.EXE" -> "Foo.EXE"; "notepad" -> "notepad.exe"; blank -> "".
export function normalizeExe(input) {
    const name = String(input ?? '')
        .trim()
        .replace(/^"+|"+$/g, '')
        .split(/[\\/]/)
        .pop()
        .trim();
    if (name === '') return '';
    return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.exe`;
}

export function addToBlacklist(list, input) {
    const exe = normalizeExe(input);
    const current = Array.isArray(list) ? list : [];
    if (exe === '' || current.some((item) => item.toLowerCase() === exe.toLowerCase())) return current;
    return [...current, exe];
}

export function clampOffset(value, fallback) {
    const number = Number(value);
    if (String(value).trim() === '' || !Number.isFinite(number)) return fallback;
    return Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, Math.round(number)));
}
