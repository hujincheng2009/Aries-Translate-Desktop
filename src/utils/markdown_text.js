import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

// Markdown results for large-language-model services (1.1.4). When "Show results as Markdown" is on, these results
// are rendered as Markdown, and everything that needs plain text (copy, read aloud, replace with translation,
// vocabulary books) gets the text with the formatting symbols removed, parsed by the same rules as the display.

export const MARKDOWN_RESULT_CONFIG_KEY = 'translate_markdown_result';
export const MARKDOWN_RESULT_SERVICES = ['openai', 'geminipro', 'gemini_free', 'chatglm', 'ollama'];

export function isMarkdownResultService(serviceName) {
    return MARKDOWN_RESULT_SERVICES.includes(serviceName);
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function inline(node) {
    switch (node.type) {
        case 'text':
        case 'inlineCode':
            return node.value;
        // Raw HTML is not rendered in the card either.
        case 'html':
            return '';
        case 'break':
            return '\n';
        case 'image':
            return node.alt ?? '';
        default:
            return (node.children ?? []).map(inline).join('');
    }
}

function block(node) {
    switch (node.type) {
        case 'root':
        case 'blockquote':
        case 'listItem':
            return node.children.map(block).filter(Boolean).join('\n');
        case 'list':
            return node.children
                .map((item, index) => {
                    const text = block(item);
                    return node.ordered ? `${(node.start ?? 1) + index}. ${text}` : text;
                })
                .join('\n');
        case 'table':
            return node.children
                .map((row) => {
                    const cells = row.children.map((cell) => inline(cell).trim());
                    return cells.join(CJK.test(cells.join('')) ? '，' : ', ');
                })
                .join('\n');
        case 'code':
            return node.value;
        case 'html':
        case 'thematicBreak':
        case 'definition':
            return '';
        default:
            return inline(node);
    }
}

export function parseMarkdown(text) {
    return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

// Plain text of a Markdown string: one line per block, list numbers kept, links and images reduced to their text.
export function markdownToPlainText(text) {
    if (typeof text !== 'string' || text.trim() === '') return '';
    return block(parseMarkdown(text)).trim();
}
