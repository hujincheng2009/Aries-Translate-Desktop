import assert from 'node:assert/strict';
import test from 'node:test';

import { isMarkdownResultService, markdownToPlainText } from '../src/utils/markdown_text.js';

test('inline formatting symbols are removed', () => {
    assert.equal(markdownToPlainText('这是**重点**和*斜体*，还有`代码`。'), '这是重点和斜体，还有代码。');
    assert.equal(markdownToPlainText('他说：*真的吗*？我说：**是的**！'), '他说：真的吗？我说：是的！');
    assert.equal(markdownToPlainText('~~删除~~ 结束'), '删除 结束');
});

test('headings, lists and links become plain lines', () => {
    assert.equal(
        markdownToPlainText('# 标题\n\n- 第一项\n- 第二项 [链接](https://a.b)\n\n1. 步骤一\n2. 步骤二'),
        '标题\n第一项\n第二项 链接\n1. 步骤一\n2. 步骤二'
    );
    assert.equal(markdownToPlainText('- [x] done\n- [ ] todo'), 'done\ntodo');
    assert.equal(markdownToPlainText('3. third\n4. fourth'), '3. third\n4. fourth');
});

test('a number at the start of a line is kept', () => {
    assert.equal(markdownToPlainText('1990. 那年发生了很多事'), '1990. 那年发生了很多事');
});

test('tables, quotes, rules and code blocks', () => {
    assert.equal(markdownToPlainText('| 词 | 释义 |\n| --- | --- |\n| apple | 苹果 |'), '词，释义\napple，苹果');
    assert.equal(markdownToPlainText('| a | b |\n| - | - |\n| c | d |'), 'a, b\nc, d');
    assert.equal(markdownToPlainText('> 引用的一句话\n\n---\n\n结束'), '引用的一句话\n结束');
    assert.equal(markdownToPlainText('```js\nconst a = 1;\n```'), 'const a = 1;');
});

test('text that is not formatting stays as it is', () => {
    assert.equal(markdownToPlainText('#hashtag 不是标题'), '#hashtag 不是标题');
    assert.equal(markdownToPlainText('价格是 $5 到 $10'), '价格是 $5 到 $10');
    assert.equal(markdownToPlainText(String.raw`C:\Users\name\file.txt`), String.raw`C:\Users\name\file.txt`);
    assert.equal(markdownToPlainText('a < b > c'), 'a < b > c');
    assert.equal(markdownToPlainText('  '), '');
    assert.equal(markdownToPlainText(undefined), '');
});

test('only large-language-model services use Markdown results', () => {
    assert.equal(isMarkdownResultService('openai'), true);
    assert.equal(isMarkdownResultService('ollama'), true);
    assert.equal(isMarkdownResultService('deepl'), false);
    assert.equal(isMarkdownResultService('plugin.demo.deeplx'), false);
});
