const {test, expect} = require('@playwright/test');
const path = require('node:path');

test.beforeEach(async ({page}, testInfo) => {
    page.runtimeErrors = [];
    page.on('pageerror', error => page.runtimeErrors.push(error.message));
    await page.goto('/tests/fixtures/editor.html?bundle=' + testInfo.project.metadata.bundle);
    await page.evaluate(() => window.editorReady);
    await page.evaluate(() => editor.setContentStyles());
});

test.afterEach(async ({page}) => { expect(page.runtimeErrors).toEqual([]); });

test('loads site and embedded styles into isolated visual editing document', async ({page}) => {
    const result = await page.evaluate(async () => {
        const editor = window.editor;
        editor.setContent('<style>.from-html-style { color: rgb(16, 128, 32); }</style><h1 class="demo-title">Styled editor</h1><p class="from-html-style">Inline stylesheet</p>');
        await new Promise(resolve => setTimeout(resolve, 80));
        return {
            bodyClass: editor.body.className,
            titleColor: editor.window.getComputedStyle(editor.body.querySelector('h1')).color,
            embeddedColor: editor.window.getComputedStyle(editor.body.querySelector('p')).color,
            styleInHead: !!editor.document.head.querySelector('[data-ue-embedded-style]'),
            toolbarTheme: getComputedStyle(document.querySelector('.edui-editor')).color,
            contentColor: editor.window.getComputedStyle(editor.body).color
        };
    });
    expect(result.bodyClass).toContain('ue-preview-demo');
    expect(result.titleColor).toBe('rgb(23, 105, 170)');
    expect(result.embeddedColor).toBe('rgb(16, 128, 32)');
    expect(result.styleInHead).toBe(true);
    expect(result.contentColor).toBe('rgb(36, 50, 71)');
    expect(result.toolbarTheme).not.toBe(result.contentColor);
});

test('loads CodeMirror 6 lazily, edits source, and syncs content back to the form', async ({page}) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    expect(await page.evaluate(() => !!window.UECodeMirror)).toBe(false);
    await page.evaluate(() => { editor.setContent(''); editor.execCommand('source'); });
    const code = page.locator('.cm-content');
    await expect(code).toBeVisible();
    await expect(page.locator('.cm-gutters')).toBeVisible();
    await expect(page.locator('.cm-lineNumbers')).toBeVisible();
    await code.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('<');
    await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible();
    await expect.poll(() => requests.some(url => url.includes('/third-party/codemirror/codemirror.js'))).toBe(true);
    await page.keyboard.press('Escape');
    await code.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('<h1 class="demo-title">Edited in source</h1><p>Saved</p>');
    await expect.poll(() => page.locator('.cm-line span').count()).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => new FormData(document.querySelector('form')).get('content'))).toContain('Edited in source');
    await expect.poll(() => page.evaluate(() => editor.getPreferences('browser-editor-draft'))).toContain('Edited in source');
    await page.evaluate(() => editor.execCommand('source'));
    await expect.poll(() => page.evaluate(() => editor.body.textContent)).toContain('Edited in source');
    await expect.poll(() => page.evaluate(() => editor.textarea.value)).toContain('Edited in source');
    expect(await page.locator('.cm-editor').count()).toBe(0);
    await page.evaluate(() => { editor.setContent('<p>Temporary</p>'); editor.execCommand('auto_save_restore'); });
    expect(await page.evaluate(() => editor.body.textContent)).toContain('Edited in source');
});

test('setDisabled and setEnabled control editing in source mode', async ({page}) => {
    let release;
    const released = new Promise(resolve => { release = resolve; });
    await page.route('**/third-party/codemirror/codemirror.js*', async route => {
        await released;
        await route.continue();
    });
    await page.evaluate(() => {
        editor.setContent('<p>Read only</p>');
        editor.execCommand('source');
        editor.setDisabled();
    });
    await expect(page.locator('.edui-editor-iframeholder > textarea')).toHaveJSProperty('readOnly', true);
    release();
    await expect(page.locator('.cm-content')).toBeVisible();
    const code = page.locator('.cm-content');
    await expect(code).toHaveAttribute('contenteditable', 'false');
    const content = await page.evaluate(() => editor.getContent());
    await code.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('<p>Must stay read only</p>');
    expect(await page.evaluate(() => editor.getContent())).toBe(content);

    await page.evaluate(() => editor.setEnabled());
    await expect(code).toHaveAttribute('contenteditable', 'true');
    await code.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('<p>Enabled again</p>');
    await expect.poll(() => page.evaluate(() => editor.getContent())).toContain('Enabled again');
    await page.evaluate(() => editor.setDisabled());
    await expect(code).toHaveAttribute('contenteditable', 'false');
});

test('runtime stylesheet switching replaces old CSS and preserves body class in full HTML', async ({page}) => {
    const data = await page.evaluate(async () => {
        const editor = window.editor;
        await editor.setContentStyles({style: '.runtime-test { color: rgb(1, 2, 3); }', bodyClass: 'runtime-body'});
        editor.setContent('<p class="runtime-test">runtime</p>');
        await new Promise(resolve => setTimeout(resolve, 20));
        const color = editor.window.getComputedStyle(editor.body.firstChild).color;
        const html = editor.getAllHtml();
        const oldStyles = editor.document.querySelectorAll('[data-ue-content-style]').length;
        await editor.setContentStyles({style: '.runtime-test { color: rgb(4, 5, 6); }', bodyClass: 'next-body'});
        return {color, html, oldStyles, nextClass: editor.body.className, updatedColor: editor.window.getComputedStyle(editor.body.firstChild).color};
    });
    expect(data.color).toBe('rgb(1, 2, 3)');
    expect(data.html).toContain('runtime-body');
    expect(data.oldStyles).toBeGreaterThan(0);
    expect(data.nextClass).toContain('next-body');
    expect(data.nextClass).not.toContain('runtime-body');
    expect(data.updatedColor).toBe('rgb(4, 5, 6)');
    const failed = await page.evaluate(async () => {
        const errors = [];
        editor.addListener('contentstyleerror', (event, url) => errors.push(url));
        const result = await editor.setContentStyles({css: ['/missing-content-style.css']});
        return {result, errors};
    });
    expect(failed.result[0].status).toBe('error');
    expect(failed.errors[0]).toContain('/missing-content-style.css');
});

test('source changes remove embedded styles and undo restores their effect', async ({page}) => {
    await page.evaluate(() => {
        editor.setContent('<style media="screen">.roundtrip { color: rgb(9, 87, 65); }</style><p class="roundtrip">Article</p>');
        editor.execCommand('source');
    });
    await expect(page.locator('.cm-editor')).toBeVisible();
    expect(await page.evaluate(() => editor.getContent())).toContain('media="screen"');
    await page.evaluate(() => {
        editor.setContent('<p class="roundtrip">Article</p>');
        editor.execCommand('source');
    });
    expect(await page.evaluate(() => editor.document.querySelectorAll('[data-ue-embedded-style]').length)).toBe(0);
    await page.evaluate(() => editor.execCommand('undo'));
    await expect.poll(() => page.evaluate(() => editor.window.getComputedStyle(editor.body.querySelector('.roundtrip')).color)).toBe('rgb(9, 87, 65)');
});

test('dialog and popup previews use the same site stylesheet and body selectors', async ({page}, testInfo) => {
    await page.evaluate(async bundle => {
        await editor.setContentStyles({
            css: ['../../' + bundle + '/themes/default/css/content-demo.css'],
            style: '.ue-preview-demo > h1 { letter-spacing: 2px; }'
        });
    }, testInfo.project.metadata.bundle);
    await page.locator('.edui-button.edui-for-preview').click();
    const preview = page.frameLocator('iframe[src*="/dialogs/preview/"]');
    await expect(preview.locator('body > h1')).toHaveCSS('color', 'rgb(23, 105, 170)');
    await expect(preview.locator('body > h1')).toHaveCSS('letter-spacing', '2px');
    await page.evaluate(() => editor.ui._dialogs.previewDialog.close());
    const popupReady = page.waitForEvent('popup');
    await page.evaluate(() => editor.execCommand('preview'));
    const popup = await popupReady;
    popup.on('pageerror', error => page.runtimeErrors.push(error.message));
    await expect(popup.locator('body > h1')).toHaveCSS('color', 'rgb(23, 105, 170)');
    await expect(popup.locator('body > h1')).toHaveCSS('letter-spacing', '2px');
    await popup.close();
});

test('source component failure retains editable text and a later toggle retries loading', async ({page}) => {
    let blocked;
    const requestBlocked = new Promise(resolve => { blocked = resolve; });
    let release;
    const released = new Promise(resolve => { release = resolve; });
    await page.route('**/third-party/codemirror/codemirror.js*', async route => {
        blocked();
        await released;
        await route.abort();
    });
    await page.evaluate(() => editor.execCommand('source'));
    await requestBlocked;
    await page.evaluate(() => {
        editor.setContent('<p>Kept during loading</p>');
        editor.execCommand('source');
        editor.execCommand('source');
        window.sourceFailure = new Promise(resolve => editor.addListener('sourceeditorerror', resolve));
    });
    release();
    await page.evaluate(() => window.sourceFailure.then(() => true));
    await expect(page.locator('.edui-editor-iframeholder > textarea')).toHaveValue(/Kept during loading/);
    await page.unroute('**/third-party/codemirror/codemirror.js*');
    await page.evaluate(() => { editor.execCommand('source'); editor.execCommand('source'); });
    await expect(page.locator('.cm-editor')).toHaveCount(1);
    await expect(page.locator('.cm-content')).toContainText('Kept during loading');
    await page.evaluate(() => editor.execCommand('source'));
    expect(await page.evaluate(() => editor.body.textContent)).toContain('Kept during loading');
});

test('uploads work with local configuration, reject business errors, and support custom attachments', async ({page}) => {
    const requests = [];
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZQAAAABJRU5ErkJggg==', 'base64');
    await page.route('**/uploaded.png', route => route.fulfill({contentType: 'image/png', body: png}));
    await page.route('**/upload?**', route => {
        requests.push(route.request());
        return route.fulfill({json: requests.length === 1 ? {state: 'SUCCESS', url: '/uploaded.png'} : {state: 'File rejected', url: '/rejected.png'}});
    });
    await page.evaluate(() => {
        Object.assign(editor.options, {serverUrl: '/upload', imageActionName: 'uploadimage', imageFieldName: 'photo', imageAllowFiles: ['.png'], imageCompressEnable: false, serverHeaders: {'X-Upload-Test': 'cms'}});
        editor.execCommand('serverparam', {tenant: 'article'});
        editor.setContent('<p>Upload here</p>');
        editor.focus(true);
    });
    const input = page.locator('.edui-for-simpleupload input[type=file]');
    await expect(input).toBeEnabled();
    await input.setInputFiles({name: 'picture.png', mimeType: 'image/png', buffer: png});
    await expect.poll(() => page.evaluate(() => editor.body.querySelectorAll('img[src="/uploaded.png"]').length)).toBe(1);
    expect(requests[0].url()).toContain('tenant=article');
    expect(requests[0].headers()['x-upload-test']).toBe('cms');
    expect(requests[0].headers()['content-type']).toContain('multipart/form-data; boundary=');
    expect(requests[0].postData()).toContain('name="photo"; filename="picture.png"');
    await input.setInputFiles({name: 'picture.png', mimeType: 'image/png', buffer: png});
    await expect.poll(() => requests.length).toBe(2);
    await expect(input).toHaveValue('');
    expect(await page.evaluate(() => editor.body.querySelectorAll('.uep-loading, img[src="/rejected.png"]').length)).toBe(0);
    await page.evaluate(() => {
        Object.assign(editor.options, {
            uploadServiceEnable: true, fileActionName: '', fileAllowFiles: ['.txt'],
            uploadServiceUpload(type, file, callbacks, options) {
                window.customUpload = {type, from: options.from, name: file.name};
                callbacks.success({url: '/notes.txt'});
            }
        });
        editor.focus(true);
        const drop = new editor.window.Event('drop', {bubbles: true, cancelable: true});
        Object.defineProperty(drop, 'dataTransfer', {value: {files: [new File(['text'], 'notes.txt', {type: 'text/plain'})]}});
        editor.body.dispatchEvent(drop);
    });
    await expect.poll(() => page.evaluate(() => editor.body.querySelectorAll('a[href="/notes.txt"]').length)).toBe(1);
    expect(await page.evaluate(() => window.customUpload)).toEqual({type: 'attachment', from: 'drop', name: 'notes.txt'});
});

test('destroying while in source mode cleans up the editor instance', async ({page}) => {
    await page.evaluate(() => editor.execCommand('source'));
    await expect(page.locator('.cm-editor')).toBeVisible();
    await page.evaluate(() => editor.destroy());
    await expect(page.locator('.cm-editor')).toHaveCount(0);
});

test('destroying during image compression stops both button and drop uploads', async ({page}) => {
    await page.evaluate(() => {
        Object.assign(editor.options, {imageActionName: 'uploadimage', imageAllowFiles: ['.png'], imageCompressEnable: true});
        window.compressions = [];
        window.uploadCount = 0;
        UE.image.compress = file => new Promise((resolve, reject) => {
            window.compressions.push({resolve: () => resolve(file), reject});
        });
        UE.api.upload = () => { window.uploadCount++; return Promise.resolve({url: '/image.png'}); };
        editor.focus(true);
    });
    await page.locator('.edui-for-simpleupload input[type=file]').setInputFiles({
        name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('compression placeholder')
    });
    await page.evaluate(() => {
        const drop = new editor.window.Event('drop', {bubbles: true, cancelable: true});
        Object.defineProperty(drop, 'dataTransfer', {value: {files: [new File(['image'], 'test.png', {type: 'image/png'})]}});
        editor.body.dispatchEvent(drop);
    });
    expect(await page.evaluate(() => window.compressions.length)).toBe(2);
    await page.evaluate(async () => {
        editor.destroy();
        window.compressions[0].resolve();
        window.compressions[1].reject(new Error('Compression cancelled'));
        await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(await page.evaluate(() => window.uploadCount)).toBe(0);
});

test('Word import awaits embedded image uploads and reports failures without retaining stale content', async ({page}) => {
    await page.evaluate(() => {
        Object.assign(editor.options, {uploadServiceEnable: true, imageActionName: '', uploadServiceUpload(type, file, callbacks, options) {
            window.importRequest = {type, name: file.name, from: options.from};
            setTimeout(() => callbacks.success({url: '/word-image.png'}), 50);
        }});
        UE.ui.contentimport(editor);
        const dialog = editor.ui._dialogs.contentimportDialog;
        dialog.render();
        dialog.open();
    });
    const frame = page.frameLocator('iframe[src*="/dialogs/contentimport/"]');
    const file = path.join(__dirname, 'fixtures/with-image.docx');
    await frame.locator('#contentImport').setInputFiles(file);
    await expect(frame.locator('.file-tip')).toHaveText('转换成功');
    await expect(frame.locator('.file-result img')).toHaveAttribute('src', '/word-image.png');
    expect(await page.evaluate(() => window.importRequest)).toEqual({type: 'image', name: 'blob.png', from: 'contentimport'});
    await page.evaluate(() => {
        editor.options.uploadServiceUpload = (type, file, callbacks) => callbacks.error('Upload unavailable');
    });
    await frame.locator('#contentImport').setInputFiles([]);
    await frame.locator('#contentImport').setInputFiles(file);
    await expect(frame.locator('.file-tip')).toContainText('Word文件转换失败:Upload unavailable');
    await expect(frame.locator('.file-result')).toBeHidden();
    expect(await frame.locator('body').evaluate(() => window.contentImport.data.result)).toBeNull();
});
