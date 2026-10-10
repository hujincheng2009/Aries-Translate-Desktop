// Figma 100:1637 and FEATURE_PLAN C1. Balance B confirmed by the user on 2026-10-09.
export const accents = [
    { value: 'neutral', swatch: ['#171717', '#FAFAFA'] },
    { value: 'aries', primary: '#FFC700', foreground: '#141414', swatch: ['#141414', '#FFC700'] },
    { value: 'blue', primary: '#2563EB', foreground: '#FFFFFF', swatch: ['#2563EB'] },
    { value: 'teal', primary: '#0D8290', vivid: '#22B5C5', foreground: '#FFFFFF', swatch: ['#0D8290'] },
    { value: 'orange', primary: '#CC4B27', vivid: '#E15D38', foreground: '#FFFFFF', swatch: ['#CC4B27'] },
    { value: 'violet', primary: '#7C3AED', foreground: '#FFFFFF', swatch: ['#7C3AED'] },
];

export function normalizeAccent(value) {
    return accents.some((accent) => accent.value === value) ? value : 'neutral';
}

export function applyAccent(value, root = document.documentElement) {
    root.dataset.accent = normalizeAccent(value);
}

export function accentFromKey(value, key) {
    const index = accents.findIndex((accent) => accent.value === normalizeAccent(value));
    if (key === 'ArrowRight') return accents[(index + 1) % accents.length].value;
    if (key === 'ArrowLeft') return accents[(index + accents.length - 1) % accents.length].value;
    if (key === 'Home') return accents[0].value;
    if (key === 'End') return accents[accents.length - 1].value;
    return null;
}
