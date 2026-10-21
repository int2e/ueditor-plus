# UEditor Plus

基于 UEditor 二次开发的富文本编辑器，让UEditor重新焕发活力

![UEditor Plus](https://ms-assets.modstart.com/demo/UEditorPlus_v2.1.0.jpeg)

[![star](https://img.shields.io/github/stars/modstart-lib/ueditor-plus.svg)](https://github.com/modstart-lib/ueditor-plus)
[![star](https://gitee.com/modstart-lib/ueditor-plus/badge/star.svg)](https://gitee.com/modstart-lib/ueditor-plus)
[![star](https://gitcode.com/modstart-lib/ueditor-plus/star/badge.svg)](https://gitcode.com/modstart-lib/ueditor-plus)

> `/dist/` 和 `/dist-min/` 目录分别为构建的非压缩和压缩版代码，可直接使用

## 功能亮点

- 支持文档一键导入，支持Word文档（docx）、Markdown文档（md）文档
- 全新的UI外观，使用字体图标替换原有图片图标
- 移除过时、无用的插件支持，不断完善使用体验
- 图片、文件、视频上传配置化定制增强
- 演示界面重构，右上角可直接查看当前演示界面代码
- 兼容现有UEditor，实现无缝切换

## 相关链接

- 在线演示：[https://open.tecmz.com/ueditor-plus/_examples/](https://open.tecmz.com/ueditor-plus/_examples/)
- 使用文档： [https://open.tecmz.com/ueditor-plus](https://open.tecmz.com/ueditor-plus)

## 使用遇到问题

自开源以来，UEditor Plus 已经被大家广泛关注，也收到了很多反馈。

为提高问题解决的效率，在提交问题时，请大家自行搭建一个最小可复现的环境代码（`zip` 压缩包 或 `git` 仓库地址），不提供的问题或者 `issue` 将不予解决和解答。

## 使用教程

### 原生使用

```html

<script id="editor" type="text/plain" style="height:300px;"></script>
<script type="text/javascript" src="/path/to/UEditorPlus/ueditor.config.js"></script>
<script type="text/javascript" src="/path/to/UEditorPlus/ueditor.all.js"></script>
<script>
    var ue = UE.getEditor('editor', {
        // ... 更多配置
    });
</script>
```

### vue2 使用

① 安装插件支持

```shell
npm i --save vue-ueditor-wrap@2.x
# 或
yarn add --save vue-ueditor-wrap@2.x
```

② 解压 UEditorPlus 到静态资源目录

复制 `dist-min` 到项目 `public/static/UEditorPlus/` 目录

③ 引入组件并使用

```html

<template>
    <div>
        <vue-ueditor-wrap v-model="content"
                          editor-id="editor"
                          :config="editorConfig"
                          :editorDependencies="['ueditor.config.js','ueditor.all.js']"
                          style="height:500px;"/>
    </div>
</template>
<script>
    import VueUeditorWrap from 'vue-ueditor-wrap'

    export default {
        components: {
            VueUeditorWrap
        },
        data() {
            return {
                content: '<p>Hello UEditorPlus</p>',
                editorConfig: {
                    // 后端服务地址，后端处理参考
                    // https://open.tecmz.com/ueditor-plus/backend.html
                    serverUrl: '/api/path/to/server',
                    UEDITOR_HOME_URL: '/static/UEditorPlus/',
                    UEDITOR_CORS_URL: '/static/UEditorPlus/',
                }
            }
        }
    }
</script>
```

### vue3 使用

① 安装插件支持

```shell
npm i --save vue-ueditor-wrap@3.x
# 或
yarn add --save vue-ueditor-wrap@3.x
```

② 解压 UEditorPlus 到静态资源目录

复制 `dist-min` 到项目 `public/static/UEditorPlus/` 目录

③ 引入组件并使用

**main.js**

```javascript
import {createApp} from 'vue'
import App from './App.vue'
import VueUeditorWrap from 'vue-ueditor-wrap';

createApp(App).use(VueUeditorWrap).mount('#app')
```

**App.vue**

```html

<template>
    <div>
        <vue-ueditor-wrap v-model="content"
                          editor-id="editor"
                          :config="editorConfig"
                          :editorDependencies="['ueditor.config.js','ueditor.all.js']"
                          style="height:500px;"/>
    </div>
</template>

<script setup>
    import {ref} from 'vue';

    const content = ref('<p>Hello UEditorPlus</p>');
    const editorConfig = {
        // 后端服务地址，后端处理参考
        // https://open.tecmz.com/ueditor-plus/backend.html
        serverUrl: '/api/path/to/server',
        UEDITOR_HOME_URL: '/static/UEditorPlus/',
        UEDITOR_CORS_URL: '/static/UEditorPlus/',
    }
</script>
```

### react 使用

① 安装插件支持

```shell
npm i --save react-ueditor-wrap
# 或
yarn add --save react-ueditor-wrap
```

② 解压 UEditorPlus 到静态资源目录

复制 `dist-min` 到项目 `public/static/UEditorPlus/` 目录

③ 引入组件并使用

```jsx
import RcUeditor from 'react-ueditor-wrap';

function App() {
    const hanldeChage = (value) => {
        console.log('RcUeditor', value);
    }
    return (
        <div className="App">
            <div style={{margin: '0 auto', maxWidth: '800px'}}>
                <RcUeditor
                    value={'<p>Hello UEditorPlus</p>'}
                    ueditorUrl={'/static/UEditorPlus/ueditor.all.js'}
                    ueditorConfigUrl={'/static/UEditorPlus/ueditor.config.js'}
                    editorConfig={{
                        // 后端服务地址，后端处理参考
                        // https://open.tecmz.com/ueditor-plus/backend.html
                        initialFrameWidth: '100%',
                        serverUrl: '/api/path/to/server',
                        UEDITOR_HOME_URL: '/static/UEditorPlus/',
                        UEDITOR_CORS_URL: '/static/UEditorPlus/',
                    }}
                    onChange={hanldeChage}/>
            </div>
        </div>
    );
}

export default App;
```

## 编辑区样式与源码编辑

### 加载站点已有样式

样式加载在编辑 iframe 内，不影响宿主页和工具栏。可同时加载多个 CSS 文件、补充 CSS 文本，并设置内容根节点的 class：

```js
const editor = UE.getEditor('editor', {
    contentCss: ['/assets/article.css', '/assets/components.css'],
    contentStyle: '.article-preview { max-width: 720px; margin: 0 auto; }',
    contentBodyClass: 'article-preview',
    contentStyleFromHTML: true,
    allowDivTransToP: false
});

// 可在 ready 前或后调用；未传入的配置保持原值，空数组/空字符串用于清除。
editor.setContentStyles({
    css: ['/assets/article-dark.css'],
    style: '.article-preview { padding: 24px; }',
    bodyClass: 'article-preview dark'
}).then(results => console.log(results)); // 每个外部 CSS 的 url 和 loaded/error/cancelled 状态

editor.addListener('contentstyleerror', function (event, url) {
    console.warn('样式加载失败', url);
});
```

- `contentCss` 支持字符串或数组，相对路径以宿主页为基准；CSS 文件里的 `url(...)` 仍按该 CSS 文件的位置解析。
- `contentStyleFromHTML` 默认为 `true`，内容中的 `<style>`（含 `media`）在可视化编辑时生效，删除、撤销和源码切换会同步。设为 `false` 可保留原先只保存样式、不在编辑区应用的行为。
- `contentBodyClass` 添加到编辑区和预览的 `body`；依赖 `div` 布局时设置 `allowDivTransToP: false`。样式中依赖的类名/祖先结构仍需与内容匹配。
- 工具栏预览和 `execCommand('preview')` 弹窗使用同一份配置；旧的 `iframeCssUrl`、`iframeCssUrlsAddition`、`iframeCssStylesAddition` 仍有效。
- `getContent()` 返回内容片段，不自动嵌入配置的外部 CSS；展示端也要加载同一份 CSS 和内容根节点 class。`getAllHtml()` 包含样式引用与 body class。
- `getContentStyles()` 可读取当前配置；`contentstylesloaded` 在本次外部 CSS 加载结束时触发，结果中包含失败项。

完整演示 `_examples/completeDemo.html` 和构建后的 `dist/index.html` 包含样式加载、清除和切换按钮。

### 源码编辑器

源码模式集成 CodeMirror 6，提供 HTML/CSS/JavaScript 混合高亮、行号、折行、括号匹配、搜索和 HTML 补全。`Ctrl-Space` 主动补全、`Ctrl/Cmd-F` 搜索、`Tab` 缩进。资源随发布包提供，首次进入源码模式时加载，不依赖 CDN；加载期间或加载失败时仍可用 textarea 编辑，加载成功后保留已输入内容。

依赖锁定在 `package-lock.json`，本次更新核对日期为 2026-10-21：`codemirror` 6.0.2、`@codemirror/view` 6.43.15、`@codemirror/state` 6.7.6、`@codemirror/commands` 6.11.1、`@codemirror/lang-html` 6.4.12。生成源码位于 `_src/vendor/codemirror.js`，离线组件及许可证位于 `third-party/codemirror/`。

`sourceEditor: 'textarea'` 可使用纯文本模式；已有的 `codeMirrorJsUrl` / `codeMirrorCssUrl` 和旧版 `window.CodeMirror` 工厂配置继续支持。源码输入会同步表单和草稿，切回可视化后进入原有撤销记录。

### 配置与插件

`loadConfigFromServer: false` 会直接进入配置就绪状态，适用于本地上传配置或自定义 `uploadServiceUpload`。使用内置上传时仍需配置 `serverUrl`、对应的 `imageActionName` / `fileActionName` 等上传参数。Word 文档中的图片通过同一套异步上传流程处理，支持自定义上传和请求头；上传失败会报告错误，不插入无效图片地址。

`disabledPlugins: ['autoupload', 'autosave']` 可在实例初始化时禁用新旧两类插件；禁用前请确认相关功能依赖，并从工具栏中移除对应按钮。`UE.api.request` 与 `UE.ajax.request` 共用 XHR 传输；Promise 接口保留 `{data, status, headers, config, request}` 响应，支持 `url`、`method`、`params`、`data`、`headers`、`timeout`、`responseType`、`withCredentials`、`signal` 和 `onUploadProgress`，不再内嵌 Axios。

## 关于Bug反馈与维护

- 众所周知 UEditor 使用的人数多，目前已经累积了N个Bug，开源不易需要大家共同维护
- 对于在实际使用中遇到的问题，如果急需解决推荐使用 [悬赏Issue](https://gitee.com/modstart-lib/ueditor-plus/reward_issues/new)，这样让更多有能力的开发者有共同维护的动力

## ✉️ 使用交流

> 添加好友请备注 UEditorPlus

<table width="100%">
    <thead>
        <tr>
            <th width="50%">微信交流群</th>
            <th>QQ交流群</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <img style="width:100%;" 
                     src="https://open.tecmz.com/code_dynamic/wx" />
            </td>
            <td>
                <img style="width:100%;"
                     src="https://open.tecmz.com/code_dynamic/qq" />
            </td>
        </tr>
    </tbody>
</table>


## 二次开发

### 第一步，clone代码到本地

```shell
git clone https://gitee.com/modstart-lib/ueditor-plus.git
```

### 第二步，开始功能开发

通过本地 HTTP 服务访问 `_examples/index.html`，完成功能开发。构建环境使用 Node.js 24（`.nvmrc`），最低要求 Node.js 22；浏览器面向现代 Chromium、Firefox 和 Safari，旧 IE 不在本次组件升级的支持范围内。

### 第三步，打包

```shell
npm ci
npm run build
npm test
npx playwright install chromium webkit
npm run test:browser
```

`npm run build` 输出完整的 `dist/` 与压缩的 `dist-min/`，构建错误会以非零状态退出。`grunt default` 仍可作为兼容入口。资源版本号根据最终文件内容计算。

`npm run build:lite` 输出相同目录的轻量包，省去 AI、Word 导入对话框及其 Vue/showdown 资源，并移除默认工具栏入口；源码编辑和样式加载仍保留。轻量包不能使用 `ai` / `contentimport` 自定义入口，发布前按需要重新运行完整或轻量构建。

测试覆盖配置就绪、请求/上传、SSE 分片与错误处理，以及 Chromium 完整包和 WebKit 压缩包的源码编辑、样式、预览、上传与销毁流程；上传和 AI 使用模拟响应，不连接实际业务后端。

## UEditor相关链接

- UEditor 官网：[http://ueditor.baidu.com](http://ueditor.baidu.com)
- UEditor API 文档：[http://ueditor.baidu.com/doc](http://ueditor.baidu.com/doc)
- UEditor 文档：[http://fex.baidu.com/ueditor/](http://fex.baidu.com/ueditor/)
- UEditor API 文档：[http://ueditor.baidu.com/doc](http://ueditor.baidu.com/doc)

## 更新日志

- [https://open.tecmz.com/ueditor-plus/change-log.html](https://open.tecmz.com/ueditor-plus/change-log.html)

## 好项目推荐

- 开源数字人系统 [AigcPanel](https://aigcpanel.com)
- 智能桌面助理 [FocusAny](https://focusany.com)
- 安卓连接助手 [LinkAndroid](https://linkandroid.com)
- 快速开发框架 [ModStart](https://modstart.com)
- 企业内容建站系统 [ModStartCMS](https://modstart.com)
- 现代化个人博客系统 [ModStartBlog](https://modstart.com)

## 开源协议

- Apache 2.0
