/** Content styles live in the editing document, isolated from the toolbar and host page. */
(function () {
    function list(value) { return value ? (Array.isArray(value) ? value : [value]) : []; }
    // Resolve against the host page, including when used by preview dialogs.
    function absolute(url) { return new URL(url, document.baseURI).href; }

    UE.Editor.prototype.getContentStyles = function () {
        return {
            css: list(this.options.contentCss).slice(),
            style: this.options.contentStyle || "",
            bodyClass: this.options.contentBodyClass || ""
        };
    };

    function apply(editor, doc, legacy) {
        var options = editor.options, styles = editor.getContentStyles();
        var css = styles.css, text = styles.style;
        if (legacy) {
            css = list(options.iframeCssUrl).concat(list(options.iframeCssUrlsAddition), css);
            text = [options.initialStyle || ""].concat(list(options.iframeCssStylesAddition), text).join("\n");
        }
        Array.prototype.forEach.call(doc.querySelectorAll('[data-ue-content-style]'), function (node) {
            if (node._ueCancel) node._ueCancel();
            node.remove();
        });
        var previous = doc.body.getAttribute('data-ue-content-class') || '';
        previous.split(/\s+/).filter(Boolean).forEach(function (name) { doc.body.classList.remove(name); });
        styles.bodyClass.split(/\s+/).filter(Boolean).forEach(function (name) { doc.body.classList.add(name); });
        doc.body.setAttribute('data-ue-content-class', styles.bodyClass);
        var embedded = doc.head.querySelector('[data-ue-embedded-style]');
        var pending = css.map(function (url) {
            return new Promise(function (resolve) {
                var link = doc.createElement('link');
                link.rel = 'stylesheet';
                link.setAttribute('data-ue-content-style', '');
                link.href = absolute(url);
                function finish(status) {
                    link.onload = link.onerror = link._ueCancel = null;
                    resolve({url: link.href, status: status});
                }
                link.onload = function () { finish('loaded'); };
                link.onerror = function () { finish('error'); };
                link._ueCancel = function () { finish('cancelled'); };
                doc.head.insertBefore(link, embedded);
            });
        });
        if (text) {
            var style = doc.createElement('style');
            style.setAttribute('data-ue-content-style', '');
            style.textContent = text;
            doc.head.insertBefore(style, embedded);
        }
        return Promise.all(pending);
    }

    UE.Editor.prototype.setContentStyles = function (styles) {
        styles = styles || {};
        if (styles.css !== undefined) this.options.contentCss = list(styles.css).slice();
        if (styles.style !== undefined) this.options.contentStyle = styles.style;
        if (styles.bodyClass !== undefined) this.options.contentBodyClass = styles.bodyClass;
        var me = this;
        if (!me.document) return new Promise(function (resolve) {
            me.ready(function () { resolve(me.setContentStyles()); });
        });
        var version = me._contentStylesVersion = (me._contentStylesVersion || 0) + 1;
        return apply(me, me.document, false).then(function (result) {
            if (me.document && version === me._contentStylesVersion) {
                result.filter(function (item) { return item.status === 'error'; }).forEach(function (item) {
                    me.fireEvent('contentstyleerror', item.url);
                });
                me.fireEvent('contentstylesloaded', result);
            }
            return result;
        });
    };

    // Used by both preview entry points; includes the older iframe style options.
    UE.Editor.prototype.applyContentStylesTo = function (doc) {
        var base = doc.querySelector('base');
        if (!base) { base = doc.createElement('base'); doc.head.insertBefore(base, doc.head.firstChild); }
        base.href = document.baseURI;
        return apply(this, doc, true);
    };

    UE.plugins.contentstyles = function () {
        var me = this, signature = '';
        function refresh() {
            if (!me.document || !me.options.contentStyleFromHTML) return;
            var styles = Array.prototype.map.call(me.body.querySelectorAll('[cdata_tag="style"]'), function (node) {
                return {css: node.getAttribute('cdata_data') || '', media: node.getAttribute('cdata_media') || ''};
            });
            var next = JSON.stringify(styles);
            if (next === signature) return;
            signature = next;
            Array.prototype.forEach.call(me.document.querySelectorAll('[data-ue-embedded-style]'), function (node) { node.remove(); });
            styles.forEach(function (item) {
                var style = me.document.createElement('style');
                style.setAttribute('data-ue-embedded-style', '');
                style.media = item.media;
                style.textContent = item.css;
                me.document.head.appendChild(style);
            });
        }
        me.addListener('ready', function () { me.setContentStyles(); refresh(); });
        me.addListener('aftersetcontent contentchange afterscencerestore', refresh);
        me.addListener('destroy', function () {
            Array.prototype.forEach.call(me.document.querySelectorAll('[data-ue-content-style]'), function (node) {
                if (node._ueCancel) node._ueCancel();
            });
        });
    };
})();
