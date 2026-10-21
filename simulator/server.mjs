import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 插件根目录: extensions/st-chronicle-scroll
const EXTENSION_ROOT = path.resolve(__dirname, '..');
const PORT = 5005;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];

    // 默认路由：沙盒主页
    if (reqUrl === '/' || reqUrl === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        return serveFile(filePath, res);
    }

    // 酒馆扩展官方路径映射: /scripts/extensions/third-party/st-chronicle-scroll/*
    const extPrefix = '/scripts/extensions/third-party/st-chronicle-scroll/';
    if (reqUrl.startsWith(extPrefix)) {
        const relativePath = reqUrl.substring(extPrefix.length);
        const filePath = path.join(EXTENSION_ROOT, relativePath);
        return serveFile(filePath, res);
    }

    // 尝试在插件根目录下寻找对应资源
    const directPath = path.join(EXTENSION_ROOT, reqUrl);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
        return serveFile(directPath, res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + reqUrl);
});

function serveFile(filePath, res) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 File Not Found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Server Error: ' + err.message);
    }
}

server.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('  SillyTavern 插件专用本地沙盒模拟器已成功启动！');
    console.log(`  本地测试地址: http://localhost:${PORT}`);
    console.log('======================================================\n');
});
