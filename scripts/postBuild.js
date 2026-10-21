const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = async function postBuild(dir, options = {}) {
    const done = new Set();
    const visiting = new Set();
    const textFile = /\.(js|html|css|json)$/;
    async function resolve(file) {
        if (done.has(file) || !textFile.test(file)) return;
        if (visiting.has(file)) throw new Error('Circular asset reference: ' + file);
        visiting.add(file);
        let content = await fs.readFile(file, 'utf8');
        const matches = [...content.matchAll(/['"]([^'"\n]+)\?\{timestamp(?::([^}]+))?\}['"]/g)];
        for (const match of matches) {
            const asset = match[1].replace(/^~\//, '');
            const candidates = [path.resolve(path.dirname(file), asset), path.resolve(dir, asset)];
            if (match[2]) candidates.push(path.resolve(dir, match[2].replace(/^dist(?:-min)?\//, '')));
            let target;
            for (const candidate of candidates) {
                if (await fs.stat(candidate).then(stat => stat.isFile(), () => false)) { target = candidate; break; }
            }
            if (!target) {
                if (!(options.excluded || []).some(ex => asset.startsWith(ex))) {
                    throw new Error(`Missing asset ${match[1]} referenced by ${file}`);
                }
                content = content.replace(match[0], match[0].replace(/\{timestamp(?::[^}]+)?\}/, options.version));
                continue;
            }
            await resolve(target);
            const hash = crypto.createHash('sha256').update(await fs.readFile(target)).digest('hex').slice(0, 10);
            content = content.replace(match[0], match[0].replace(/\{timestamp(?::[^}]+)?\}/, hash));
        }
        await fs.writeFile(file, content);
        visiting.delete(file);
        done.add(file);
    }
    async function walk(current) {
        for (const item of await fs.readdir(current, {withFileTypes: true})) {
            const file = path.join(current, item.name);
            if (item.isDirectory()) await walk(file);
            else await resolve(file);
        }
    }
    await walk(dir);
};
