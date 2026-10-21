var contentImport = {};
var g = $G;

contentImport.data = {
    result: null,
};
contentImport.init = function (opt, callbacks) {
    addUploadButtonListener();
    addOkListener();
};
function upload(blob) {
    var type = (blob.type || 'image/png').split('/')[1];
    var file = new File([blob], blob.name || 'blob.' + type, {type: blob.type});
    return UE.api.upload(editor, editor.getOpt('imageActionName'), editor.getOpt('imageFieldName'), file, {
        type: 'image', from: 'contentimport'
    }).then(function (result) {
        return (editor.getOpt('imageUrlPrefix') || '') + result.url;
    });
}
function processWord(file) {
    var imageUploadError;
    contentImport.data.result = null;
    $('.file-tip').html('正在转换Word文件，请稍后...');
    $('.file-result').html('').hide();
    var reader = new FileReader();
    reader.onload = function (loadEvent) {
        mammoth.convertToHtml({
            arrayBuffer: loadEvent.target.result
        }, {
            convertImage: mammoth.images.imgElement(function (image) {
                return image.readAsArrayBuffer().then(function (imageBuffer) {
                    return upload(new Blob([imageBuffer], {type: image.contentType}));
                }).then(function (url) {
                    return {src: url, alt: '文档图片'};
                }).catch(function (error) {
                    // Mammoth collects image errors as warnings; keep this import from silently losing images.
                    imageUploadError = error;
                    throw error;
                })
            })
        })
            .then(function displayResult(result) {
                if (imageUploadError) throw imageUploadError;
                $('.file-tip').html('转换成功');
                contentImport.data.result = result.value;
                $('.file-result').html(result.value).show();
            }).catch(function (error) {
                $('.file-tip').html('Word文件转换失败:' + error);
            });
    };
    reader.onerror = function (loadEvent) {
        $('.file-tip').html('Word文件转换失败:' + loadEvent);
    };
    reader.readAsArrayBuffer(file);
}

function processMarkdown( markdown ){
    var converter = new showdown.Converter();
    var html = converter.makeHtml(markdown);
    $('.file-tip').html('转换成功');
    contentImport.data.result = html;
    $('.file-result').html(html).show();
}

function processMarkdownFile(file) {
    contentImport.data.result = null;
    $('.file-tip').html('正在转换Markdown文件，请稍后...');
    $('.file-result').html('').hide();
    var reader = new FileReader();
    reader.onload = function (loadEvent) {
        processMarkdown( loadEvent.target.result );
    };
    reader.onerror = function (loadEvent) {
        $('.file-tip').html('Markdown文件转换失败:' + loadEvent);
    };
    reader.readAsText(file, "UTF-8");
}

function addUploadButtonListener() {
    g('contentImport').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const fileName = file.name;
        const fileExt = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
        switch (fileExt) {
            case 'docx':
            case 'doc':
                processWord(file);
                break;
            case 'md':
                processMarkdownFile(file);
                break;
            default:
                $('.file-tip').html('不支持的文件格式:' + fileExt);
                break;
        }
    });
    g('fileInputConfirm').addEventListener('click', function () {
        processMarkdown( g('fileInputContent').value );
        $('.file-input').hide();
    });
}

function addOkListener() {
    dialog.onok = function () {
        if (!contentImport.data.result) {
            alert('请先上传文件识别内容');
            return false;
        }
        editor.fireEvent('saveScene');
        editor.execCommand("inserthtml", contentImport.data.result);
        editor.fireEvent('saveScene');
    };
    dialog.oncancel = function () {
    };
}
