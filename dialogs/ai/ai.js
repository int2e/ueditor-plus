var aiConfig = editor.getOpt('ai')

var aiFunctions = editor.getOpt('aiFunctions');

var isMultiLine = function (text) {
    return text.indexOf('\n') !== -1;
}

var fetchStream = function (url, option, onStream, onFinish) {
    var controller = new AbortController(), reader, finished = false;
    var textList = [];
    function cancelReader() {
        if (reader) reader.cancel().catch(function () {});
    }
    function finish(result) {
        if (finished) return;
        finished = true;
        cancelReader();
        onFinish(result);
    }
    function success() { finish({code: 0, msg: 'ok', data: {text: textList.join('')}}); }
    function processEvent(event) {
        var lines = event.split(/\r?\n/).filter(function (line) { return line.indexOf('data:') === 0; });
        if (!lines.length) return;
        var json = lines.map(function (line) { return line.slice(5).replace(/^ /, ''); }).join('\n');
        if (json.trim() === '[DONE]') { success(); return; }
        var data = JSON.parse(json), text;
        if (data.error) { finish({code: -1, msg: data.error.message || String(data.error)}); return; }
        if (data.choices && data.choices[0] && data.choices[0].delta) text = data.choices[0].delta.content;
        else if (data.type === 'error') { finish({code: -1, msg: data.data}); return; }
        else if (data.type === 'end') { success(); return; }
        else if (data.type === 'data') text = data.data;
        // Role, usage and stop-reason events legitimately carry no text.
        if (typeof text === 'string' && text) {
            textList.push(text);
            onStream({code: 0, msg: 'ok', data: {text: text}});
        }
    }
    fetch(url, Object.assign({method: 'POST'}, option, {signal: controller.signal})).then(async function (response) {
        if (finished) return;
        if (!response.ok) throw new Error('HTTP ' + response.status);
        reader = response.body.getReader();
        var decoder = new TextDecoder('utf-8'), buffer = '';
        while (!finished) {
            var chunk = await reader.read();
            if (finished) return;
            buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, {stream: true});
            var separator;
            while (!finished && (separator = /\r?\n\r?\n/.exec(buffer))) {
                var event = buffer.slice(0, separator.index);
                buffer = buffer.slice(separator.index + separator[0].length);
                processEvent(event);
            }
            if (chunk.done) {
                if (!finished && buffer.trim()) processEvent(buffer);
                if (!finished) success();
                return;
            }
        }
    }).catch(function (error) {
        if (!finished) finish({code: -1, msg: error.message || String(error)});
    });
    return function () {
        finished = true;
        controller.abort();
        cancelReader();
    };
};

var openAiCompletion = function (url, param, option) {
    option = Object.assign({
        body: null
    }, option)
    if (!option.body) {
        option.body = {
            model: aiConfig.driverConfig.model,
            messages: [
                { role: 'system', content: param.systemPromptText },
                { role: 'user', content: param.promptText },
            ],
            stream: true,
        }
    }
    return fetchStream(
        url,
        {
            headers: {
                'Authorization': `Bearer ${aiConfig.driverConfig.key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(option.body)
        },
        param.onStream,
        param.onFinish
    )
}

var drivers = {
    'ModStart': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url, param, {
            body: {
                systemPrompt: param.systemPromptText,
                prompt: param.promptText
            }
        })
    },
    'OpenAi': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://api.openai.com/v1/chat/completions', param)
    },
    'DeepSeek': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://api.deepseek.com/v1/chat/completions', param)
    },
    'Anthropic': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://api.anthropic.com/v1/messages', param)
    },
    'Google': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', param)
    },
    'Baidu': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions', param)
    },
    'Alibaba': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', param)
    },
    'Tencent': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://hunyuan.tencentcloudapi.com/v1/chat/completions', param)
    },
    'Huawei': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://pangu.huaweicloud.com/v1/chat/completions', param)
    },
    'ByteDance': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', param)
    },
    'Zhipu': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://open.bigmodel.cn/api/paas/v4/chat/completions', param)
    },
    'Moonshot': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://api.moonshot.cn/v1/chat/completions', param)
    },
    'iFlytek': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://spark-api-open.xf-yun.com/v1/chat/completions', param)
    },
    'Volcengine': function (param) {
        return openAiCompletion(aiConfig.driverConfig.url || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', param)
    },
}

function getRequest(driver) {
    if (aiConfig.driverRequest) {
        return aiConfig.driverRequest
    }
    if (driver in drivers) {
        return drivers[driver]
    }
    return null
}

var converter = new window.showdown.Converter();

var AiDefaultAiFunctionParam = {
    showInsert: true,
    showReplace: true,
    showReplaceAll: false,
};

var Ai = {
    runtime: {
        range: null,
    },
    init: function () {
        var app = new Vue({
            el: '#app',
            data: {
                loading: false,
                selectText: '',
                inputText: '',
                submitFunction: null,
                systemPromptText: '',
                promptText: '',
                resultText: '',
                resultError: '',
                functions: [],
                cancelRequest: null,
                showInsert: AiDefaultAiFunctionParam.showInsert,
                showReplace: AiDefaultAiFunctionParam.showReplace,
                showReplaceAll: AiDefaultAiFunctionParam.showReplaceAll,
            },
            mounted: function () {
                Ai.runtime.range = editor.selection.getRange();
                var cloneContents = Ai.runtime.range.cloneContents();
                if (cloneContents) {
                    this.selectText = cloneContents.textContent.trim();
                } else {
                    this.selectText = '';
                }
                this.buildFunctions()
            },
            computed: {
                resultHtml: function () {
                    if (!this.resultText) {
                        return '';
                    }
                    return converter.makeHtml(this.resultText);
                },
                resultHeight: function () {
                    let height = 255
                    if (this.selectText) {
                        height -= 45
                    }
                    if (this.resultError) {
                        height -= 45
                    }
                    return height + 'px'
                }
            },
            methods: {
                buildFunctions: function () {
                    var enableParam = {
                        selectText: this.selectText
                    }
                    this.functions = aiFunctions.map(function (f) {
                        if (!f.enable(enableParam)) {
                            return null;
                        }
                        var copy = Object.assign({}, f);
                        copy.prompt = f.prompt.replace(/\{selectText\}/g, function () { return enableParam.selectText; });
                        copy.prompt = copy.prompt.replace(/\{html\}/g, function () { return editor.getContent(); });
                        copy.param = Object.assign({}, AiDefaultAiFunctionParam, f.param);
                        return copy;
                    }).filter(function (f) {
                        return !!f;
                    });
                },
                doSubmit: function () {
                    if (this.loading) {
                        return;
                    }
                    if (!this.systemPromptText) {
                        editor.tipError('请输入系统提示语');
                        return;
                    }
                    this.loading = true;
                    this.resultError = '';
                    this.resultText = '';
                    var driverRequest = getRequest(aiConfig.driver)
                    if (!driverRequest) {
                        editor.tipError('未找到驱动');
                        this.loading = false;
                        return;
                    }
                    try {
                        this.cancelRequest = driverRequest({
                            systemPromptText: this.systemPromptText,
                            promptText: this.promptText,
                            onStream: (res) => {
                                if (res.code) {
                                    this.resultError = res.msg;
                                    return;
                                }
                                this.resultText += res.data.text
                            },
                            onFinish: (res) => {
                                this.loading = false;
                                this.cancelRequest = null;
                                if (res.code) {
                                    this.resultError = res.msg;
                                    return;
                                }
                                this.resultText = res.data.text;
                            }
                        });
                    } catch (error) {
                        this.loading = false;
                        this.resultError = error.message || String(error);
                    }
                },
                doSubmitFunction: function (f) {
                    this.submitFunction = f;
                    this.systemPromptText = f.systemPrompt || '';
                    this.promptText = f.prompt || '';
                    this.showInsert = f.param.showInsert;
                    this.showReplace = f.param.showReplace;
                    this.showReplaceAll = f.param.showReplaceAll;
                    this.doSubmit()
                },
                doSubmitDirect: function () {
                    this.submitFunction = null;
                    this.systemPromptText = this.inputText || '';
                    if (!this.systemPromptText) {
                        editor.tipError('请输入系统提示语');
                        return;
                    }
                    this.showInsert = AiDefaultAiFunctionParam.showInsert;
                    this.showReplace = AiDefaultAiFunctionParam.showReplace;
                    this.showReplaceAll = AiDefaultAiFunctionParam.showReplaceAll;
                    this.doSubmit()
                },
                doInsert: function () {
                    editor.fireEvent('saveScene');
                    if (this.selectText) {
                        if (isMultiLine(this.resultText)) {
                            Ai.runtime.range.insertNode(document.createRange().createContextualFragment(this.resultHtml));
                        } else {
                            Ai.runtime.range.insertNode(document.createTextNode(this.resultText));
                        }
                    } else {
                        if (isMultiLine(this.resultText)) {
                            editor.execCommand('insertHtml', this.resultHtml);
                        } else {
                            editor.execCommand('insertHtml', this.resultText);
                        }
                    }
                    dialog.close(true);
                },
                doReplace: function () {
                    editor.fireEvent('saveScene');
                    Ai.runtime.range.deleteContents();
                    if (isMultiLine(this.resultText)) {
                        Ai.runtime.range.insertNode(document.createRange().createContextualFragment(this.resultHtml));
                    } else {
                        Ai.runtime.range.insertNode(document.createTextNode(this.resultText));
                    }
                    dialog.close(true);
                },
                doReplaceAll: function () {
                    editor.fireEvent('saveScene');
                    editor.setContent(this.resultText);
                    dialog.close(true);
                }
            }
        });
        function onClose() {
            dialog.removeListener('close', onClose);
            if (typeof app.cancelRequest === 'function') app.cancelRequest();
            app.cancelRequest = null;
            app.loading = false;
        }
        dialog.addListener('close', onClose);
    },
};
utils.domReady(function () {
    Ai.init();
});
