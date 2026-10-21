/**
 * 预览
 * @file
 * @since 1.2.6.1
 */

/**
 * 预览
 * @command preview
 * @method execCommand
 * @param { String } cmd 命令字符串
 * @example
 * ```javascript
 * editor.execCommand( 'preview' );
 * ```
 */
UE.commands["preview"] = {
    execCommand: function () {
        var w = window.open("", "_blank", "");
        if (!w) return;
        var d = w.document;
        var rootPath = new URL(this.options.UEDITOR_HOME_URL, document.baseURI).href;
        d.open();
        d.write('<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body class="view"></body></html>');
        d.close();
        d.body.innerHTML = this.getContent(null, null, true);
        this.applyContentStylesTo(d);
        utils.loadFile(d, {tag: 'script', src: rootPath + 'ueditor.parse.js'}, function () {
            w.uParse('body', {rootPath: rootPath});
        });
    },
    notNeedUndo: 1
};
