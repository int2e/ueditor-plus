(function () {
    UE.Editor.prototype.loadServerConfig = function () {
        var me = this;
        function finishConfig() {
            if (!me.options) return;
            me._serverConfigLoaded = true;
            me.fireEvent("serverConfigLoaded");
        }
        setTimeout(function () {
            if (!me.options) return;

            if(me.options.loadConfigFromServer===false){
                finishConfig();
                return;
            }

            try {
                me.options.imageUrl &&
                me.setOpt(
                    "serverUrl",
                    me.options.imageUrl.replace(
                        /^(.*[\/]).+([\.].+)$/,
                        "$1controller$2"
                    )
                );

                var configUrl = me.getActionUrl("config"),
                    isJsonp = utils.isCrossDomainUrl(configUrl);

                /* 发出ajax请求 */
                me._serverConfigLoaded = false;

                if (!configUrl) {
                    finishConfig();
                    return;
                }
                UE.ajax.request(configUrl, {
                    method: "GET",
                    dataType: isJsonp && !(me.options.serverHeaders && Object.keys(me.options.serverHeaders).length) ? "jsonp" : "",
                    headers: me.options.serverHeaders || {},
                    onsuccess: function (r) {
                        try {
                            if (!me.options) return;
                            var config = UE.api.parseResponse(me, r && typeof r.responseText === 'string' ? r.responseText : r);
                            me.options = utils.merge(me.options, config);
                        } catch (e) {
                            showErrorMsg(me.getLang("loadconfigFormatError")+':'+e);
                            return;
                        }
                        finishConfig();
                    },
                    onerror: function () {
                        if (!me.options) return;
                        showErrorMsg(me.getLang("loadconfigHttpError"));
                    }
                });


            } catch (e) {
                showErrorMsg(me.getLang("loadconfigError"));
            }
        });

        function showErrorMsg(msg) {
            if (!me.options) return;
            console && console.error(msg);
            me.fireEvent('serverConfigError', msg);
            //me.fireEvent('showMessage', {
            //    'title': msg,
            //    'type': 'error'
            //});
        }
    };

    UE.Editor.prototype.isServerConfigLoaded = function () {
        var me = this;
        return me._serverConfigLoaded || false;
    };

    UE.Editor.prototype.afterConfigReady = function (handler) {
        if (!handler || !utils.isFunction(handler)) return;
        var me = this;
        var readyHandler = function () {
            me.removeListener("serverConfigLoaded", readyHandler);
            handler.apply(me, arguments);
        };

        if (me.isServerConfigLoaded()) {
            handler.call(me, "serverConfigLoaded");
        } else {
            me.addListener("serverConfigLoaded", readyHandler);
        }
    };
})();
