/**
 * 源码编辑插件
 * @file
 * @since 1.2.6.1
 */

(function () {
    var loads = {};
    function loadCodeMirror(opt) {
        var src = opt.codeMirrorJsUrl || opt.UEDITOR_HOME_URL + "third-party/codemirror/codemirror.js?{timestamp}";
        if (!loads[src]) {
            loads[src] = new Promise(function (resolve, reject) {
                var script = document.createElement('script');
                script.src = src;
                script.onload = function () {
                    var factory = opt.codeMirrorJsUrl && window.CodeMirror ||
                        window.UECodeMirror && window.UECodeMirror.create || window.CodeMirror;
                    if (factory) resolve(factory);
                    else { delete loads[src]; reject(new Error('Source editor component is unavailable')); }
                };
                script.onerror = function () { script.remove(); delete loads[src]; reject(new Error('Unable to load ' + src)); };
                document.head.appendChild(script);
            });
        }
        return loads[src];
    }
    var sourceEditors = {
        textarea: function (editor, holder) {
            var textarea = holder.ownerDocument.createElement("textarea");
            textarea.style.cssText =
                "position:absolute;resize:none;width:100%;height:100%;border:0;padding:0;margin:0;overflow-y:auto;";
            // todo: IE下只有onresize属性可用... 很纠结
            if (browser.ie && browser.version < 8) {
                textarea.style.width = holder.offsetWidth + "px";
                textarea.style.height = holder.offsetHeight + "px";
                holder.onresize = function () {
                    textarea.style.width = holder.offsetWidth + "px";
                    textarea.style.height = holder.offsetHeight + "px";
                };
            }
            holder.appendChild(textarea);
            textarea.setAttribute('aria-label', 'HTML source');
            textarea.oninput = function () { editor.sync(); editor.fireEvent('contentchange'); };
            return {
                setContent: function (content) {
                    textarea.value = content;
                },
                getContent: function () {
                    return textarea.value;
                },
                setReadOnly: function (value) {
                    textarea.readOnly = value;
                },
                select: function () {
                    var range;
                    if (browser.ie) {
                        range = textarea.createTextRange();
                        range.collapse(true);
                        range.select();
                    } else {
                        //todo: chrome下无法设置焦点
                        textarea.setSelectionRange(0, 0);
                        textarea.focus();
                    }
                },
                dispose: function () {
                    holder.removeChild(textarea);
                    // todo
                    holder.onresize = null;
                    textarea = null;
                    holder = null;
                },
                focus: function () {
                    textarea.focus();
                },
                blur: function () {
                    textarea.blur();
                }
            };
        },
        codemirror: function (editor, holder, factory) {
            var muted = false;
            var readOnly = !!editor.bkqueryCommandState;
            var codeEditor = factory(holder, {
                mode: "text/html",
                tabMode: "indent",
                lineNumbers: true,
                lineWrapping: true,
                readOnly: readOnly,
                onChange: function (v) {
                    if (muted) return;
                    editor.sync();
                    editor.fireEvent("contentchange");
                    // console.log('CodeMirror.onChange',v.getValue());
                }
            });
            // console.log('sourceEditor',codeEditor);
            var dom = codeEditor.getWrapperElement();
            dom.style.cssText =
                'position:absolute;left:0;top:0;width:100%;height:100%;font-family:consolas,"Courier new",monospace;font-size:13px;';
            if (!codeEditor.view) {
                codeEditor.getScrollerElement().style.cssText =
                    "position:absolute;left:0;top:0;width:100%;height:100%;";
            }
            codeEditor.refresh();
            return {
                getCodeMirror: function () {
                    return codeEditor;
                },
                setContent: function (content) {
                    muted = true;
                    codeEditor.setValue(content);
                    muted = false;
                },
                getContent: function () {
                    return codeEditor.getValue();
                },
                setReadOnly: function (value) {
                    readOnly = value;
                    codeEditor.setOption('readOnly', value);
                },
                select: function () {
                    codeEditor.focus();
                },
                dispose: function () {
                    if (codeEditor.destroy) codeEditor.destroy();
                    if (dom.parentNode) dom.parentNode.removeChild(dom);
                    dom = null;
                    codeEditor = null;
                },
                focus: function () {
                    codeEditor.focus();
                },
                blur: function () {
                    if (codeEditor.blur) { codeEditor.blur(); return; }
                    // codeEditor.blur();
                    // since codemirror not support blur()
                    codeEditor.setOption('readOnly', true);
                    codeEditor.setOption('readOnly', readOnly);
                }
            };
        }
    };

    UE.plugins["source"] = function () {
        var me = this;
        var opt = this.options;
        var sourceMode = false;
        var sourceEditor;
        var orgSetContent;
        var orgFocus;
        var orgBlur;
        var orgHasContents;
        var destroyed = false;
        var generation = 0;
        opt.sourceEditor = browser.ie
            ? "textarea"
            : opt.sourceEditor || "codemirror";

        me.setOpt({
            sourceEditorFirst: false
        });

        var sourceFactory = opt.codeMirrorJsUrl ? window.CodeMirror :
            window.UECodeMirror && window.UECodeMirror.create || window.CodeMirror;
        function createSourceEditor(holder) {
            var editor = sourceEditors[opt.sourceEditor === 'codemirror' && sourceFactory ? 'codemirror' : 'textarea'](me, holder, sourceFactory);
            editor.setReadOnly(!!me.bkqueryCommandState);
            return editor;
        }

        var bakCssText;
        //解决在源码模式下getContent不能得到最新的内容问题
        var oldGetContent, bakAddress;

        /**
         * 切换源码模式和编辑模式
         * @command source
         * @method execCommand
         * @param { String } cmd 命令字符串
         * @example
         * ```javascript
         * editor.execCommand( 'source');
         * ```
         */

        /**
         * 查询当前编辑区域的状态是源码模式还是可视化模式
         * @command source
         * @method queryCommandState
         * @param { String } cmd 命令字符串
         * @return { int } 如果当前是源码编辑模式，返回1，否则返回0
         * @example
         * ```javascript
         * editor.queryCommandState( 'source' );
         * ```
         */

        me.commands["source"] = {
            execCommand: function () {
                sourceMode = !sourceMode;
                if (sourceMode) {
                    if (opt.sourceEditor === 'codemirror') {
                        utils.loadFile(document, {
                            tag: 'link', rel: 'stylesheet', type: 'text/css',
                            href: opt.codeMirrorCssUrl || opt.UEDITOR_HOME_URL + 'third-party/codemirror/codemirror.css?{timestamp}'
                        });
                    }
                    bakAddress = me.selection.getRange().createAddress(false, true);
                    me.undoManger && me.undoManger.save(true);
                    if (browser.gecko) {
                        me.body.contentEditable = false;
                    }

                    bakCssText = me.iframe.style.cssText;
                    me.iframe.style.cssText +=
                        "position:absolute;left:-32768px;top:-32768px;";

                    me.fireEvent("beforegetcontent");
                    var root = UE.htmlparser(me.body.innerHTML);
                    me.filterOutputRule(root);
                    root.traversal(function (node) {
                        if (node.type == "element") {
                            switch (node.tagName) {
                                case "td":
                                case "th":
                                case "caption":
                                    if (node.children && node.children.length == 1) {
                                        if (node.firstChild().tagName == "br") {
                                            node.removeChild(node.firstChild());
                                        }
                                    }
                                    break;
                                case "pre":
                                    node.innerText(node.innerText().replace(/&nbsp;/g, " "));
                            }
                        }
                    });

                    me.fireEvent("aftergetcontent");

                    var content = root.toHtml(true);

                    sourceEditor = createSourceEditor(me.iframe.parentNode);

                    sourceEditor.setContent(content);

                    orgSetContent = me.setContent;

                    me.setContent = function (html, append) {
                        sourceEditor.setContent((append ? sourceEditor.getContent() : '') + (html || ''));
                        me.sync();
                        me.fireEvent('contentchange');
                    };

                    var currentGeneration = ++generation;
                    setTimeout(function () {
                        if (!destroyed && sourceMode && generation === currentGeneration) sourceEditor.select();
                    });
                    if (opt.sourceEditor === 'codemirror' && !sourceFactory) {
                        loadCodeMirror(opt).then(function (factory) {
                            sourceFactory = factory;
                            if (destroyed || !sourceMode || generation !== currentGeneration) return;
                            var value = sourceEditor.getContent();
                            var upgraded = createSourceEditor(me.iframe.parentNode);
                            upgraded.setContent(value);
                            sourceEditor.dispose();
                            sourceEditor = upgraded;
                            sourceEditor.focus();
                            me.fireEvent('sourceeditorready');
                        }).catch(function (error) {
                            if (!destroyed) me.fireEvent('sourceeditorerror', error);
                        });
                    }

                    //重置getContent，源码模式下取值也能是最新的数据
                    oldGetContent = me.getContent;
                    orgHasContents = me.hasContents;
                    me.getContent = function () {
                        return (
                            sourceEditor.getContent() ||
                            "<p>" + (browser.ie ? "" : "<br/>") + "</p>"
                        );
                    };
                    me.hasContents = function () { return !!sourceEditor.getContent(); };

                    orgFocus = me.focus;
                    orgBlur = me.blur;

                    me.focus = function () {
                        sourceEditor.focus();
                    };

                    me.blur = function () {
                        orgBlur.call(me);
                        sourceEditor.blur();
                    };
                } else {
                    me.iframe.style.cssText = bakCssText;
                    var cont =
                        sourceEditor.getContent() ||
                        "<p>" + (browser.ie ? "" : "<br/>") + "</p>";
                    //处理掉block节点前后的空格,有可能会误命中，暂时不考虑
                    cont = cont.replace(
                        new RegExp("[\\r\\t\\n ]*</?(\\w+)\\s*(?:[^>]*)>", "g"),
                        function (a, b) {
                            if (b && !dtd.$inlineWithA[b.toLowerCase()]) {
                                return a.replace(/(^[\n\r\t ]*)|([\n\r\t ]*$)/g, "");
                            }
                            return a.replace(/(^[\n\r\t]*)|([\n\r\t]*$)/g, "");
                        }
                    );

                    me.setContent = orgSetContent;
                    me.getContent = oldGetContent;
                    me.focus = orgFocus;
                    me.blur = orgBlur;
                    me.hasContents = orgHasContents;
                    me.setContent(cont);
                    sourceEditor.dispose();
                    sourceEditor = null;

                    var first = me.body.firstChild;
                    //trace:1106 都删除空了，下边会报错，所以补充一个p占位
                    if (!first) {
                        me.body.innerHTML = "<p>" + (browser.ie ? "" : "<br/>") + "</p>";
                        first = me.body.firstChild;
                    }

                    //要在ifm为显示时ff才能取到selection,否则报错
                    //这里不能比较位置了
                    me.undoManger && me.undoManger.save(true);

                    if (browser.gecko) {
                        var input = document.createElement("input");
                        input.style.cssText = "position:absolute;left:0;top:-32768px";

                        document.body.appendChild(input);

                        me.body.contentEditable = false;
                        setTimeout(function () {
                            if (destroyed) { domUtils.remove(input); return; }
                            domUtils.setViewportOffset(input, {left: -32768, top: 0});
                            input.focus();
                            setTimeout(function () {
                                if (!destroyed) {
                                    me.body.contentEditable = !me.bkqueryCommandState;
                                    me.selection.getRange().moveToAddress(bakAddress).select(true);
                                }
                                domUtils.remove(input);
                            });
                        });
                    } else {
                        //ie下有可能报错，比如在代码顶头的情况
                        try {
                            me.selection.getRange().moveToAddress(bakAddress).select(true);
                        } catch (e) {
                        }
                    }
                }
                this.fireEvent("sourcemodechanged", sourceMode);
            },
            queryCommandState: function () {
                return sourceMode | 0;
            },
            notNeedUndo: 1
        };
        var oldQueryCommandState = me.queryCommandState;

        me.queryCommandState = function (cmdName) {
            cmdName = cmdName.toLowerCase();
            if (sourceMode) {
                //源码模式下可以开启的命令
                return cmdName in
                {
                    source: 1,
                    fullscreen: 1
                }
                    ? 1
                    : -1;
            }
            return oldQueryCommandState.apply(this, arguments);
        };

        me.addListener('editablechanged', function (event, editable) {
            if (sourceEditor) sourceEditor.setReadOnly(!editable);
        });
        me.addListener('fullscreenchanged', function () {
            if (sourceEditor && sourceEditor.getCodeMirror) sourceEditor.getCodeMirror().refresh();
        });
        me.addListener('destroy', function () {
            destroyed = true;
            if (sourceEditor) {
                var content = sourceEditor.getContent();
                sourceEditor.dispose();
                sourceEditor = null;
                // Editor.destroy reads the current content after the destroy event.
                me.getContent = function () { return content; };
            }
        });
        me.addListener('ready', function () {
            if (opt.sourceEditorFirst) me.execCommand('source');
        });
    };
})();
