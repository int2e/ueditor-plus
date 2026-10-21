const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const esbuild = require('esbuild');
const buildVendor = require('./build-vendor');
const postBuild = require('./postBuild');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');
const lite = process.argv.includes('--lite');
const excluded = lite ? ['dialogs/ai', 'dialogs/contentimport', 'third-party/vue.js', 'third-party/showdown.js'] : [];
const banner = `/*! ${pkg.title} v${pkg.version} */\n`;

async function write(file, content) {
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, content);
}

async function files(dir) {
    const result = [];
    for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) result.push(...await files(file));
        else result.push(file);
    }
    return result;
}

async function main() {
    process.chdir(root);
    // Validate inputs before replacing a previous build.
    const sourcePaths = require('./sources.json');
    for (const file of sourcePaths) await fs.access(path.join('_src', file));
    await buildVendor();
    for (const dir of ['dist', 'dist-min']) {
        await fs.rm(path.join(root, dir), {recursive: true, force: true});
        await fs.mkdir(dir);
    }
    for (const item of ['themes', 'dialogs', 'lang', 'third-party', 'plugins']) {
        await fs.cp(item, path.join('dist', item), {
            recursive: true,
            filter: source => {
                const name = source.split(path.sep).join('/');
                return !name.includes('/_css') && !name.endsWith('.less') &&
                    !name.endsWith('.DS_Store') && !excluded.some(ex => name === ex || name.startsWith(ex + '/'));
            }
        });
    }
    let config = await fs.readFile('ueditor.config.js', 'utf8');
    if (lite) config += '\n' +
        'UEDITOR_CONFIG.toolbars = UEDITOR_CONFIG.toolbars.map(function(row) { return row.filter(function(name) { return ["ai", "contentimport"].indexOf(name) < 0; }); });\n' +
        'UEDITOR_CONFIG.shortcutMenu = UEDITOR_CONFIG.shortcutMenu.filter(function(name) { return name !== "ai"; });\n';
    await write('dist/ueditor.config.js', config);
    const source = (await Promise.all(sourcePaths.map(async file =>
        `// ${file}\n` + (await fs.readFile(path.join('_src', file), 'utf8')).replace('/_css/', '/css/')
    ))).join('\n');
    await write('dist/ueditor.all.js', banner + '(function(){\n' + source + '\n})();\n');
    const parseSource = await Promise.all(['parse', 'insertcode', 'table', 'background', 'list'].map(name =>
        fs.readFile(`_parse/${name}.js`, 'utf8')));
    await write('dist/ueditor.parse.js', banner + '(function(){\n' + parseSource.join('\n') + '\n})();\n');
    const cssEntry = await fs.readFile('themes/default/_css/ueditor.css', 'utf8');
    const css = await Promise.all([...cssEntry.matchAll(/@import\s+["']([^"']+)["'];/g)].map(match =>
        fs.readFile(path.join('themes/default/_css', match[1]), 'utf8')));
    await write('dist/themes/default/css/ueditor.css', css.join('\n'));
    let demo = await fs.readFile('_examples/completeDemo.html', 'utf8');
    demo = demo.replace(/\.\.\//g, '').replace('editor_api.js', 'ueditor.all.js').replace(/\s*<script src="\.\/example.js"><\/script>/, '');
    await write('dist/index.html', demo);
    await fs.copyFile('_examples/style.css', 'dist/style.css');
    await fs.cp('dist', 'dist-min', {recursive: true});
    for (const file of await files('dist-min')) {
        const extension = path.extname(file);
        if (extension !== '.js' && extension !== '.css') continue;
        const result = await esbuild.transform(await fs.readFile(file, 'utf8'), {
            loader: extension === '.js' ? 'js' : 'css',
            minify: true,
            target: 'es2018',
            legalComments: 'inline',
            sourcefile: file
        });
        if (result.warnings.length && extension === '.css' && result.warnings.every(w => w.text === 'Expected identifier but found "*"')) {
            console.warn(`Preserving legacy CSS hacks: ${file}`);
            continue;
        }
        if (result.warnings.length) throw new Error(result.warnings.map(w => `${file}: ${w.text}`).join('\n'));
        await write(file, banner + result.code);
    }
    // Hash final bytes, after every transformation, and resolve referenced files first.
    for (const dir of ['dist', 'dist-min']) await postBuild(path.join(root, dir), {excluded, version: pkg.version});
    for (const file of ['ueditor.all.js', 'third-party/codemirror/codemirror.js']) {
        const bytes = await fs.readFile(path.join('dist-min', file));
        console.log(`${file}: ${(bytes.length / 1024).toFixed(1)} KiB (${(zlib.gzipSync(bytes).length / 1024).toFixed(1)} KiB gzip)`);
    }
    console.log(`Built dist/ and dist-min/ (${lite ? 'lite' : 'full'}).`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
