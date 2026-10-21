/** Promise API backed by the same transport as UE.ajax. */
UE.api = {
    parseResponse: function (editor, response) {
        if (response && response._raw !== undefined) response = response._raw;
        if (typeof response === 'string') response = JSON.parse(response);
        var prepare = editor.getOpt('serverResponsePrepare');
        return prepare ? prepare(response) : response;
    },
    prepareUploadResponse: function (editor, response, prepared) {
        var result = prepared ? response : this.parseResponse(editor, response);
        // Custom services may omit state, but an explicit failure must not be inserted.
        if (!result || !result.url || (result.state !== 'SUCCESS' && !(prepared && result.state === undefined))) {
            throw new Error(result && result.state || 'Upload failed');
        }
        return result;
    },
    customUpload: function (editor, type, file, options) {
        return new Promise(function (resolve, reject) {
            editor.getOpt('uploadServiceUpload')(type, file, {
                success: resolve, error: reject, progress: options.progress || function () {}
            }, {from: options.from || 'upload'});
        });
    },
    customUploader: function (editor, type, from) {
        return function (file, callback) {
            UE.api.customUpload(editor, type, file, {
                from: from,
                progress: function (percent) { callback.onProgress(file, percent); }
            }).then(function (result) {
                callback.onSuccess(file, {_raw: JSON.stringify(result)});
            }, function (error) { callback.onError(file, error); });
        };
    },
    upload: function (editor, action, fieldName, file, options) {
        options = options || {};
        if (editor.getOpt('uploadServiceEnable')) {
            return this.customUpload(editor, options.type || 'image', file, options).then(function (response) {
                return UE.api.prepareUploadResponse(editor, response, true);
            });
        }
        var data = new FormData();
        data.append(fieldName || 'upfile', file, file.name || 'upload');
        return this.requestAction(editor, action, {data: data}).then(function (response) {
            return UE.api.prepareUploadResponse(editor, response.data);
        });
    },
    requestAction: function (editor, action, config) {
        config = Object.assign({}, config, {
            url: editor.getActionUrl(action), method: 'post',
            params: Object.assign({}, config && config.params, editor.queryCommandValue('serverparam') || {})
        });
        return this.request(editor, config);
    },
    request: function (editor, config) {
        config = Object.assign({}, config, {headers: Object.assign({}, config.headers, editor.getOpt('serverHeaders'))});
        return new Promise(function (resolve, reject) {
            UE.ajax.send(config, function (error, xhr) {
                var data = xhr.response;
                if ((!config.responseType || config.responseType === 'json') && typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (parseError) { /* Preserve non-JSON responses like the previous API. */ }
                }
                var headers = {};
                (xhr.getAllResponseHeaders() || '').trim().split(/[\r\n]+/).forEach(function (line) {
                    var index = line.indexOf(':');
                    if (index >= 0) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
                });
                var response = {data: data, status: xhr.status, statusText: xhr.statusText, headers: headers, config: config, request: xhr};
                if (error) {
                    error.response = response;
                    error.request = xhr;
                    error.config = config;
                    reject(error);
                } else resolve(response);
            });
        });
    }
};
