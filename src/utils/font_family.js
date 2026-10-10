export const DEFAULT_SANS_FONT_STACK = [
    'Segoe UI Variable Text',
    'Segoe UI',
    'Microsoft YaHei UI',
    'Noto Sans SC',
    'Arial',
    'sans-serif',
];

const GENERIC_FONT_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);

function isDefaultFont(font) {
    return !font || font === 'default';
}

function formatFontFamily(font) {
    if (GENERIC_FONT_FAMILIES.has(font)) return font;
    if (font === 'Arial') return font;
    return `"${font.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export function buildFontFamily(primaryFont, fallbackFont) {
    const fonts = [];
    const add = (font) => {
        if (!fonts.includes(font)) fonts.push(font);
    };

    if (!isDefaultFont(primaryFont)) add(primaryFont);
    if (!isDefaultFont(fallbackFont)) add(fallbackFont);
    if (isDefaultFont(primaryFont) || isDefaultFont(fallbackFont)) {
        DEFAULT_SANS_FONT_STACK.forEach(add);
    } else {
        add('sans-serif');
    }

    return fonts.map(formatFontFamily).join(', ');
}
