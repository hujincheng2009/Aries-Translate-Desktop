// Run with the existing Vite app-preview server and Playwright CLI. Headless browsers hide scrollbars, so open the
// session with the checked-in config that keeps them visible:
//   playwright-cli -s=<name> open --config tests/playwright-cli.config.json http://localhost:1420/app-preview.html
//   playwright-cli -s=<name> run-code --filename tests/ui_visual_regression.js --raw
// This exercises rendered pixels and the real full-window scroll containers with in-memory fixtures.
// The CLI expects a function expression without a trailing statement semicolon.
// prettier-ignore
async (page) => {
    const checks = [],
        failures = [],
        measurements = [],
        errors = [];
    const check = (name, ok) => {
        checks.push(name);
        if (!ok) failures.push(name);
    };
    const makeUrl = (args) => 'http://localhost:1420/app-preview.html?' + new URLSearchParams(args);
    const waitRendered = (p) =>
        p.waitForFunction(() => document.querySelectorAll('#root div').length > 5, {}, { timeout: 20000 });
    const readPixels = async (p, png) =>
        p.evaluate(
            (base64) =>
                new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onerror = reject;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const sample = (x) =>
                            Array.from(ctx.getImageData(x, Math.floor(img.height / 2), 1, 1).data).slice(0, 3);
                        resolve({
                            width: img.width,
                            height: img.height,
                            leftEdge: sample(0),
                            leftHalf: sample(Math.floor(img.width / 4)),
                            rightHalf: sample(Math.floor((img.width * 3) / 4)),
                        });
                    };
                    img.src = 'data:image/png;base64,' + base64;
                }),
            png.toString('base64')
        );
    // Device-pixel colours of the 1px strip at CSS `y`, across a window that is `width` CSS px wide.
    const readRow = async (p, y, width) => {
        const png = await p.screenshot({ clip: { x: 0, y, width, height: 1 } });
        return p.evaluate(
            (base64) =>
                new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onerror = reject;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = 1;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const data = ctx.getImageData(0, 0, img.width, 1).data;
                        resolve(Array.from({ length: img.width }, (_, i) => Array.from(data.slice(i * 4, i * 4 + 3))));
                    };
                    img.src = 'data:image/png;base64,' + base64;
                }),
            png.toString('base64')
        );
    };
    // Everything the user sees or can hit around the scrollbar of the page's .window-scroll container (the translate
    // list or the settings content). wry starts a window resize for any left-button press within tao's
    // BORDERLESS_RESIZE_INSET (5 CSS px, floor(5 * scale) device px) of the window edge, so the scrollbar and every
    // pixel of the container must stay out of that band, and the scrollbar must keep a visible gap to the cards.
    const checkWindowScroll = async (p, tag, scale) => {
        const geo = await p.evaluate(() => {
            const el = document.querySelector('.window-scroll');
            const root = document.documentElement;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
                vw: root.clientWidth,
                vh: root.clientHeight,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                height: r.height,
                track:
                    el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                cardRight: Math.max(
                    ...Array.from(el.querySelectorAll('.rounded-xl')).map((c) => c.getBoundingClientRect().right)
                ),
                // drag layers that overlap the scroll container (the settings sidebar has its own, on the left)
                dragOverlaps: Array.from(document.querySelectorAll('[data-tauri-drag-region]')).filter((layer) => {
                    const d = layer.getBoundingClientRect();
                    return (
                        Math.min(d.right, r.right) - Math.max(d.left, r.left) > 0.01 &&
                        Math.min(d.bottom, r.bottom) - Math.max(d.top, r.top) > 0.01
                    );
                }).length,
            };
        });
        const band = Math.floor(5 * scale);
        check('滚动条已渲染，轨道宽 12 px ' + tag, Math.abs(geo.track - 12) < 0.6);
        check(
            '滚动条避开右侧缩放命中带 ' + tag,
            geo.vw - geo.right >= 7.95 && (geo.vw - geo.right) * scale - band >= 3
        );
        check(
            '滚动条避开底部缩放命中带 ' + tag,
            geo.vh - geo.bottom >= 7.95 && (geo.vh - geo.bottom) * scale - band >= 3
        );
        check('缩略条与内容之间至少 8 px ' + tag, geo.right - 4 - geo.cardRight >= 7.95);
        check('窗口拖动区没有覆盖滚动区 ' + tag, geo.dragOverlaps === 0);
        const hits = await p.evaluate((s) => {
            const el = document.querySelector('.window-scroll');
            const vw = document.documentElement.clientWidth,
                vh = document.documentElement.clientHeight;
            const bandCss = Math.floor(5 * s) / s;
            const r = el.getBoundingClientRect();
            const found = [];
            for (const y of [r.top + 10, (r.top + r.bottom) / 2, r.bottom - 10])
                for (const x of [vw - 0.5, vw - bandCss / 2, vw - bandCss + 0.2])
                    if (el.contains(document.elementFromPoint(x, y))) found.push([x, y]);
            for (const y of [vh - 0.5, vh - bandCss / 2, vh - bandCss + 0.2])
                for (const x of [8, vw / 2, vw - 20])
                    if (el.contains(document.elementFromPoint(x, y))) found.push([x, y]);
            return found;
        }, scale);
        check('右、下缩放命中带内没有滚动区的任何部分 ' + tag, hits.length === 0);
        // what is actually painted along a row through the thumb: window edge gap, thumb, gap to the cards
        const thumbHeight = Math.max(20, (geo.height * geo.clientHeight) / geo.scrollHeight);
        const rowY = geo.top + Math.min(30, thumbHeight / 2);
        // scanned from the window edge inwards: edge gap, thumb run (and its middle colour), gap to the cards
        const scanRow = (fullRow) => {
            // drop the partly covered last device column (350 CSS px at 125% is 437.5 device px)
            const row = fullRow.slice(0, Math.floor(geo.vw * scale));
            const bg = row[row.length - 1];
            const isBg = (c) => c.every((v, i) => Math.abs(v - bg[i]) <= 3);
            let i = row.length - 1,
                rightGap = 0,
                thumb = 0,
                leftGap = 0;
            while (i >= 0 && isBg(row[i])) (rightGap++, i--);
            while (i >= 0 && !isBg(row[i]) && thumb < 60) (thumb++, i--);
            const colour = row[i + 1 + Math.floor(thumb / 2)];
            while (i >= 0 && isBg(row[i])) (leftGap++, i--);
            return { rightGap, thumb, leftGap, colour };
        };
        const { rightGap, thumb, leftGap, colour } = scanRow(await readRow(p, rowY, geo.vw));
        check('缩略条离窗口右缘约 8 px ' + tag, Math.abs(rightGap - 8 * scale) <= 1.6);
        check('缩略条为 4 px 宽的圆头条 ' + tag, Math.abs(thumb - 4 * scale) <= 2.1);
        check('缩略条左侧留白不少于 8 px ' + tag, leftGap >= 8 * scale - 2.6);
        // hover changes only the colour (1.0.9 bug: the `background` shorthand made the hovered thumb 12px wide)
        await p.mouse.move(geo.right - 2, rowY);
        await p.waitForTimeout(150);
        const hovered = scanRow(await readRow(p, rowY, geo.vw));
        if (Math.abs(hovered.thumb - thumb) > 1)
            await p.screenshot({ path: 'output/playwright/110-hover-failure-' + tag.replace(/[ /]/g, '_') + '.png' });
        await p.mouse.move(geo.vw / 2, geo.top + 5);
        check('悬停时缩略条宽度不变 ' + tag, Math.abs(hovered.thumb - thumb) <= 1);
        check('悬停时缩略条变色 ' + tag, hovered.colour.some((v, i) => Math.abs(v - colour[i]) >= 10));
        // real mouse drags: on the visible thumb and in the transparent part that is still grab area
        const dragFrom = async (dx) => {
            await p.evaluate(() => {
                document.querySelector('.window-scroll').scrollTop = 0;
            });
            const x = geo.right - dx,
                y = geo.top + Math.min(30, thumbHeight / 2);
            await p.mouse.move(x, y);
            await p.mouse.down();
            await p.mouse.move(x, y + 40, { steps: 6 });
            await p.mouse.up();
            return p.evaluate(() => document.querySelector('.window-scroll').scrollTop);
        };
        const overflow = geo.scrollHeight - geo.clientHeight;
        check('测试内容溢出不少于 60 px ' + tag, overflow >= 60);
        const dragVisible = await dragFrom(2);
        const dragGap = await dragFrom(8);
        check('鼠标拖动缩略条后内容滚动 ' + tag, dragVisible > 0);
        check('鼠标拖动缩略条透明抓取区后内容滚动 ' + tag, dragGap > 0);
        await p.evaluate(() => {
            document.querySelector('.window-scroll').scrollTop = 0;
        });
        return { ...geo, rightGap, thumb, leftGap, colour, hovered, overflow, dragVisible, dragGap };
    };
    for (const scale of [1, 1.25, 1.5, 2])
        for (const theme of ['light', 'dark']) {
            const context = await page
                .context()
                .browser()
                .newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: scale });
            const p = await context.newPage();
            p.on('pageerror', (error) => errors.push(error.message));
            await p.goto(makeUrl({ window: 'config', route: '/general', theme, lang: 'zh_cn' }));
            await p.getByRole('radiogroup').waitFor({ timeout: 15000 });
            const radios = p.getByRole('radio');
            const swatches = [];
            if (scale <= 1.25) {
                for (const index of [0, 1]) {
                    const swatch = radios.nth(index).locator('span');
                    const png = await swatch.screenshot({
                        path: 'output/playwright/110-swatch-' + scale + '-' + theme + '-' + index + '.png',
                    });
                    const pixels = await readPixels(p, png);
                    const expectedLeft = index === 0 ? [23, 23, 23] : [20, 20, 20];
                    const expectedRight = index === 0 ? [250, 250, 250] : [255, 199, 0];
                    const matches = (actual, expected) =>
                        actual.every((channel, i) => Math.abs(channel - expected[i]) < 6);
                    check(
                        '双色圆点保留左右配色 ' + scale + '/' + theme + '/' + index,
                        matches(pixels.leftHalf, expectedLeft) && matches(pixels.rightHalf, expectedRight)
                    );
                    if (theme === 'dark')
                        check(
                            '双色圆点左缘没有白黄细线 ' + scale + '/' + index,
                            pixels.leftEdge[0] < 128 && pixels.leftEdge[1] < 128
                        );
                    const geometry = await radios.nth(index).evaluate((el) => {
                        const a = el.getBoundingClientRect(),
                            b = el.querySelector('span').getBoundingClientRect();
                        return {
                            button: [a.width, a.height],
                            dot: [b.width, b.height],
                            centered:
                                Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 0.05 &&
                                Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 0.05,
                        };
                    });
                    check(
                        '28/20px 圆点居中 ' + scale + '/' + theme + '/' + index,
                        geometry.centered &&
                            geometry.button.every((n) => Math.abs(n - 28) < 0.05) &&
                            geometry.dot.every((n) => Math.abs(n - 20) < 0.05)
                    );
                    swatches.push({ index, pixels, geometry });
                }
                await radios.nth(0).focus();
                await p.keyboard.press('ArrowRight');
                await p.waitForFunction(() => document.documentElement.dataset.accent === 'aries');
                check(
                    '主题键盘选择与标签同步 ' + scale + '/' + theme,
                    (await radios.nth(1).getAttribute('aria-checked')) === 'true' &&
                        (await p.getByRole('radiogroup').locator('..').innerText()).includes('Aries')
                );
                await p
                    .getByRole('radiogroup')
                    .locator('..')
                    .screenshot({ path: 'output/playwright/110-picker-' + scale + '-' + theme + '.png' });
            }
            const settings = await checkWindowScroll(p, '设置窗口 ' + scale + '/' + theme, scale);
            await p.screenshot({ path: 'output/playwright/110-settings-' + scale + '-' + theme + '.png' });
            await p.setViewportSize({ width: 350, height: 420 });
            await p.goto(
                makeUrl({
                    window: 'translate',
                    theme,
                    lang: 'en',
                    sample: 'translation',
                    text: 'A long paragraph for scrolling. '.repeat(70),
                    'store.translate_service_list': '["bing","google","deepl","yandex","baidu","tencent"]',
                    'store.tts_service_list': '[]',
                    'store.translate_close_on_blur': 'false',
                })
            );
            await p.waitForFunction(
                () =>
                    Array.from(document.querySelectorAll('.window-scroll')).some(
                        (el) => el.scrollHeight > el.clientHeight + 60
                    ),
                {},
                { timeout: 15000 }
            );
            const translate = await checkWindowScroll(p, '翻译窗口 ' + scale + '/' + theme, scale);
            await p.screenshot({ path: 'output/playwright/110-translate-' + scale + '-' + theme + '.png' });
            measurements.push({ scale, theme, swatches, settings, translate });
            await context.close();
        }
    // Every window with enough content to scroll: no scrollbar (outer or inner) may reach the resize band.
    const audits = [];
    const auditContext = await page
        .context()
        .browser()
        .newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1.25 });
    const ap = await auditContext.newPage();
    ap.on('pageerror', (error) => errors.push(error.message));
    const auditCases = [
        [
            '翻译窗口',
            { width: 350, height: 420 },
            { window: 'translate', sample: 'translation', text: 'A long paragraph for scrolling. '.repeat(70) },
        ],
        [
            '识别窗口',
            { width: 800, height: 400 },
            { window: 'recognize', ocr: 'Recognized line of text for overflow. '.repeat(120) },
        ],
        [
            '朗读窗口',
            { width: 520, height: 320 },
            { window: 'read_aloud', read_aloud: 'Read aloud sentence number one. '.repeat(80) },
        ],
        ['更新窗口', { width: 600, height: 260 }, { window: 'updater', update: 'available' }],
        ...['general', 'translate', 'recognize', 'hotkey', 'service', 'history', 'backup', 'about'].map((route) => [
            '设置窗口 /' + route,
            { width: 800, height: 600 },
            { window: 'config', route: '/' + route, sample: 'history,plugins' },
        ]),
    ];
    for (const [name, size, args] of auditCases) {
        await ap.setViewportSize(size);
        await ap.goto(makeUrl({ theme: 'dark', lang: 'en', ...args }));
        await waitRendered(ap);
        await ap.waitForTimeout(1500);
        const scrollers = await ap.evaluate(() => {
            const vw = document.documentElement.clientWidth,
                vh = document.documentElement.clientHeight;
            return Array.from(document.querySelectorAll('*')).flatMap((el) => {
                const cs = getComputedStyle(el),
                    r = el.getBoundingClientRect();
                const borders = ['Left', 'Right', 'Top', 'Bottom'].map((s) => parseFloat(cs['border' + s + 'Width']));
                const vBar =
                    /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1
                        ? el.offsetWidth - el.clientWidth - borders[0] - borders[1]
                        : 0;
                const hBar =
                    /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1
                        ? el.offsetHeight - el.clientHeight - borders[2] - borders[3]
                        : 0;
                // collapsed result cards keep a zero-height textarea that reports a scrollbar
                if ((vBar <= 0 && hBar <= 0) || r.width <= 0 || r.height <= 1) return [];
                return [
                    {
                        tag: el.tagName.toLowerCase(),
                        cls: String(el.className).slice(0, 50),
                        vBar,
                        hBar,
                        right: vw - r.right + borders[1],
                        bottom: vh - r.bottom + borders[3],
                    },
                ];
            });
        });
        const exposed = scrollers.filter((s) => s.right < 7.95 || s.bottom < 7.95);
        check(name + ' 没有滚动条落进右、下缩放命中带', exposed.length === 0);
        audits.push({ name, scrollers, exposed });
    }
    await auditContext.close();
    check('无浏览器运行时异常', errors.length === 0);
    return {
        passed: failures.length === 0,
        checksPassed: checks.length - failures.length,
        checks,
        failures,
        errors,
        audits,
        measurements,
    }
}
