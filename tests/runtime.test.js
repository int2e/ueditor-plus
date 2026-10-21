const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function run(source, context) {
    vm.runInNewContext(fs.readFileSync(path.join(root, source), 'utf8'), context, {filename: source});
}

test('disabled server config resolves config-ready callbacks', () => {
    const UE = {Editor: {prototype: {}}, ajax: {request() { throw new Error('must not request'); }}};
    const context = {
        UE,
        utils: {isCrossDomainUrl: () => false, isFunction: value => typeof value === 'function', trim: value => value},
        setTimeout: callback => callback(),
        console
    };
    run('_src/core/api.js', context);
    run('_src/core/loadconfig.js', context);
    const events = [], listeners = {};
    const editor = {
        options: {loadConfigFromServer: false},
        fireEvent(event) { events.push(event); if (listeners[event]) listeners[event](); },
        addListener(event, callback) { listeners[event] = callback; }, removeListener(event) { delete listeners[event]; }, getActionUrl() { return '/config'; },
        isServerConfigLoaded() { return UE.Editor.prototype.isServerConfigLoaded.call(this); }
    };
    Object.assign(editor, UE.Editor.prototype);
    let called = 0;
    editor.afterConfigReady(() => called++);
    editor.loadServerConfig();
    editor.afterConfigReady(() => called++);
    assert.equal(editor.isServerConfigLoaded(), true);
    assert.equal(called, 2);
    assert.deepEqual(events, ['serverConfigLoaded']);
});

test('server config parses JSON and sets ready state before notifying listeners', () => {
    const UE = {Editor: {prototype: {}}, ajax: {request(url, opts) { opts.onsuccess({responseText: '{"imageActionName":"upload"}'}); }}};
    const context = {
        UE,
        utils: {
            isCrossDomainUrl: () => false,
            isFunction: value => typeof value === 'function',
            trim: value => value,
            merge: (target, source) => Object.assign(target, source)
        },
        setTimeout: callback => callback(), console
    };
    run('_src/core/api.js', context);
    run('_src/core/loadconfig.js', context);
    const editor = {
        options: {loadConfigFromServer: true, serverUrl: '/api', serverHeaders: {}, serverResponsePrepare: value => value},
        getOpt(name) { return this.options[name]; }, getActionUrl: () => '/api/config', getLang: () => 'error', fireEvent(name) { this.notifiedReady = this._serverConfigLoaded; }
    };
    Object.assign(editor, UE.Editor.prototype);
    editor.loadServerConfig();
    assert.equal(editor.options.imageActionName, 'upload');
    assert.equal(editor.notifiedReady, true);
});

test('failed server config does not announce successful readiness', () => {
    for (const failure of ['invalid-json', 'http']) {
        const events = [];
        const UE = {Editor: {prototype: {}}, ajax: {request(url, opts) {
            if (failure === 'http') opts.onerror();
            else opts.onsuccess({responseText: '<html>Server error</html>'});
        }}};
        const context = {UE, utils: {isCrossDomainUrl: () => false}, setTimeout: callback => callback(), console: {error() {}}};
        run('_src/core/api.js', context);
        run('_src/core/loadconfig.js', context);
        const editor = {
            options: {serverUrl: '/api'}, getActionUrl: () => '/api/config',
            getOpt(name) { return this.options[name]; }, getLang: () => 'error',
            fireEvent(name) { events.push(name); }
        };
        Object.assign(editor, UE.Editor.prototype);
        editor.loadServerConfig();
        assert.equal(editor.isServerConfigLoaded(), false);
        assert.deepEqual(events, ['serverConfigError']);
    }
});

test('plugin disablement applies before registered and legacy plugin setup', () => {
    const calls = [];
    const UE = {plugins: {legacy: function () { calls.push('legacy'); }}};
    const utils = {
        isFunction: value => typeof value === 'function',
        each(object, iterator) {
            if (Array.isArray(object)) object.forEach((value, index) => iterator(value, index));
            else Object.keys(object || {}).forEach(key => iterator(object[key], key));
        },
        isArray: Array.isArray, trim: value => String(value).trim()
    };
    run('_src/core/plugin.js', {UE, utils});
    UE.plugin.register('registered', function () { calls.push('factory'); return {}; });
    const editor = {options: {disabledPlugins: ['registered', 'legacy']}, commands: {}, addListener() {}, addshortcutkey() {}, setOpt() {}};
    UE.plugin.load(editor);
    assert.deepEqual(calls, []);
    UE.plugin.register('active', function () { return {}; });
    const target = {calls: 0};
    UE.plugin.register('run-check', function () { this.calls++; });
    UE.plugin.run('run-check', target);
    assert.equal(target.calls, 1);
});

test('upload response normalization accepts successful JSON and rejects backend failures', () => {
    const UE = {};
    run('_src/core/api.js', {UE});
    const editor = {getOpt: name => name === 'serverResponsePrepare' ? response => Object.assign(response, {normalized: true}) : undefined};
    assert.deepEqual(UE.api.prepareUploadResponse(editor, {state: 'SUCCESS', url: '/img.png'}), {
        state: 'SUCCESS', url: '/img.png', normalized: true
    });
    assert.throws(() => UE.api.prepareUploadResponse(editor, {state: 'ERROR'}), /ERROR/);
});

test('shared XHR transport sends API parameters and parses Promise responses', async () => {
    const requests = [];
    class MockXHR {
        constructor() { this.headers = {}; requests.push(this); }
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(name, value) { this.headers[name] = value; }
        getAllResponseHeaders() { return 'content-type: application/json'; }
        send(data) { this.sentData = data; this.status = 200; this.statusText = 'OK'; this.response = '{"state":"SUCCESS","url":"/image.png"}'; this.onload(); }
    }
    class MockFormData { get [Symbol.toStringTag]() { return 'FormData'; } append(name, value, filename) { this.entry = {name, value, filename}; } }
    const UE = {};
    const context = {UE, XMLHttpRequest: MockXHR, FormData: MockFormData};
    run('_src/core/ajax.js', Object.assign(context, {utils: {isArray: Array.isArray, isEmptyObject: value => !Object.keys(value || {}).length, isFunction: value => typeof value === 'function', isString: value => typeof value === 'string'}}));
    run('_src/core/api.js', context);
    const editor = {
        getActionUrl: action => '/upload?action=' + action,
        queryCommandValue: () => ({tenant: 'cms'}),
        getOpt: name => name === 'serverHeaders' ? {'X-Test': 'yes'} : name === 'serverResponsePrepare' ? value => value : undefined
    };
    const result = await UE.api.upload(editor, 'image', 'upfile', {name: 'photo.png'});
    assert.equal(result.url, '/image.png');
    assert.match(requests[0].url, /tenant=cms/);
    assert.equal(requests[0].headers['X-Test'], 'yes');
    assert.equal(requests[0].headers['Content-Type'], undefined);
    assert.ok(requests[0].sentData instanceof MockFormData);
});

function loadAi(streamChunks) {
    const callbacks = {};
    const bytes = streamChunks.map(chunk => typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    let index = 0;
    const context = {
        editor: {getOpt(name) { return name === 'ai' ? {driver: 'test'} : []; }},
        window: {showdown: {Converter: function () { this.makeHtml = value => value; }}},
        Vue: function () {},
        utils: {domReady() {}},
        TextDecoder, AbortController,
        fetch: () => Promise.resolve({ok: true, body: {getReader: () => ({read: () => Promise.resolve(index < bytes.length ? {done: false, value: bytes[index++]} : {done: true}), cancel() { return Promise.resolve(); }})}})
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'dialogs/ai/ai.js'), 'utf8'), context);
    const result = new Promise(resolve => {
        context.fetchStream('/stream', {}, value => callbacks.stream = (callbacks.stream || []).concat(value.data.text), value => { callbacks.finishCount = (callbacks.finishCount || 0) + 1; resolve(value); });
    });
    return result.then(finish => ({finish, stream: callbacks.stream || [], finishCount: callbacks.finishCount}));
}

test('AI SSE handles split CRLF events, UTF-8 boundaries, and finish exactly once', async () => {
    const encoded = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"!"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
    const chunks = Array.from(encoded, byte => Uint8Array.of(byte));
    const {finish, stream, finishCount} = await loadAi(chunks);
    assert.equal(finishCount, 1);
    assert.deepEqual(stream, ['你好', '!']);
    assert.equal(finish.data.text, '你好!');
    assert.equal(finish.code, 0);
});

test('AI SSE treats no-text usage events and EOF as normal completion', async () => {
    const {finish, stream} = await loadAi(['data: {"choices":[{"delta":{"role":"assistant"}}]}\n\ndata: {"choices":[{"delta":{"content":"done"}}]}']);
    assert.deepEqual(stream, ['done']);
    assert.equal(finish.data.text, 'done');
});

test('AI SSE reports malformed events and provider errors once', async () => {
    for (const event of ['data: {broken}\n\n', 'data: {"error":{"message":"quota exceeded"}}\n\n']) {
        const {finish, finishCount, stream} = await loadAi([event, 'data: [DONE]\n\n']);
        assert.equal(finish.code, -1);
        assert.equal(finishCount, 1);
        assert.equal(stream.length, 0);
    }
});

test('closing an AI request aborts the transport and ignores subsequent data', async () => {
    let signal, resolveRead, cancelled = 0, callbacks = 0;
    const context = {
        editor: {getOpt: name => name === 'ai' ? {} : []},
        window: {showdown: {Converter: function () {}}}, Vue: function () {},
        utils: {domReady() {}}, TextDecoder, AbortController,
        fetch: (url, options) => {
            signal = options.signal;
            return Promise.resolve({ok: true, body: {getReader: () => ({
                read: () => new Promise(resolve => { resolveRead = resolve; }),
                cancel() { cancelled++; return Promise.resolve(); }
            })}});
        }
    };
    run('dialogs/ai/ai.js', context);
    const cancel = context.fetchStream('/stream', {}, () => callbacks++, () => callbacks++);
    await Promise.resolve();
    cancel();
    resolveRead({done: false, value: new TextEncoder().encode('data: {"type":"data","data":"late"}\n\n')});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(signal.aborted, true);
    assert.equal(cancelled, 1);
    assert.equal(callbacks, 0);
});
