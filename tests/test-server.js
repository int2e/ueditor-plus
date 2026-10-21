const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json'};
const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) { response.writeHead(404).end('not found'); return; }
        if (pathname === '/tests/fixtures/editor.html' && url.searchParams.get('bundle') === 'dist-min') {
            data = data.toString().replaceAll('/dist/', '/dist-min/');
        }
        response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
        response.end(data);
    });
});
server.listen(4173, '127.0.0.1');
