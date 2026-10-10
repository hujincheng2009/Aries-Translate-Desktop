const guides = import.meta.glob('./*.md', { query: '?raw', import: 'default' });

export function guideLanguage(language = '') {
    if (/^(zh[-_]tw|zh[-_]hk|zh[-_]hant)/i.test(language)) return 'zh_TW';
    return /^zh/i.test(language) ? 'zh_CN' : 'en_US';
}

export function hasServiceGuide(provider) {
    return Boolean(guides[`./${provider}.en_US.md`]);
}

export function loadServiceGuide(provider, language) {
    const loader = guides[`./${provider}.${guideLanguage(language)}.md`] ?? guides[`./${provider}.en_US.md`];
    return loader ? loader() : Promise.resolve('');
}
