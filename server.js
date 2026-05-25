/**
 * JS 堆栈解析器 - 后端服务
 * 
 * 双击 EXE 直接运行，自动打开浏览器
 * 端口被占用时自动尝试下一个端口
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./src/routes/api');

const app = express();
let PORT = parseInt(process.env.PORT, 10) || 3020;
const MAX_PORT_TRIES = 10;

const isPkg = typeof process.pkg !== 'undefined';
const publicPath = path.join(__dirname, 'public');

// 中间件
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use('/api', apiRoutes);
app.use(express.static(publicPath, { maxAge: 0, etag: false }));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

/**
 * 尝试启动，端口被占用则 +1 重试
 */
function tryStart(port, maxRetries) {
  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║     JS 堆栈解析器                     ║');
    console.log('  ║                                      ║');
    console.log(`  ║  ${url.padEnd(37)}║`);
    console.log('  ║                                      ║');
    console.log('  ║  按 Ctrl+C 关闭                      ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');

    // 自动打开浏览器
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        execSync(`start "" "${url}"`, { stdio: 'ignore' });
      } else if (process.platform === 'darwin') {
        execSync(`open "${url}"`, { stdio: 'ignore' });
      } else {
        execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
      }
    } catch (_) { /* 忽略 */ }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (maxRetries > 0) {
        const nextPort = port + 1;
        console.log(`  ⚠ 端口 ${port} 被占用，尝试 ${nextPort}...`);
        server.close(() => tryStart(nextPort, maxRetries - 1));
      } else {
        console.error('');
        console.error(`  ❌ 端口 ${port} 被占用，已尝试 ${MAX_PORT_TRIES} 个端口均失败`);
        console.error('  请关闭占用端口的程序后重试');
        console.error('');
        waitAndExit();
      }
    } else {
      console.error('');
      console.error('  ❌ 启动失败:', err.message);
      console.error('');
      waitAndExit();
    }
  });
}

function waitAndExit() {
  console.error('  按任意键退出...');
  try { require('child_process').execSync('pause', { stdio: 'inherit' }); } catch (_) {}
  process.exit(1);
}

// 检查 public 目录
if (!fs.existsSync(publicPath)) {
  console.error('');
  console.error('  ❌ 找不到前端文件:', publicPath);
  console.error('  请确保 public/index.html 已打包进 EXE');
  console.error('');
  waitAndExit();
}

tryStart(PORT, MAX_PORT_TRIES);
