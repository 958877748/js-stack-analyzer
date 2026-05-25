/**
 * JS 堆栈解析器 - 后端服务
 * 
 * 双击 EXE 直接运行，自动打开浏览器
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3020;

// 判断是否为 pkg 打包环境
// pkg: __dirname 是虚拟文件系统路径，public/ 作为 asset 被打包在内
// 非 pkg: __dirname 是项目目录
const isPkg = typeof process.pkg !== 'undefined';
const publicPath = path.join(__dirname, 'public');

// 中间件
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// API 路由
app.use('/api', apiRoutes);

// 静态文件 - 前端页面
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 启动
function start() {
  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║     JS 堆栈解析器                     ║');
    console.log('  ║                                      ║');
    console.log(`  ║  http://localhost:${PORT}                ║`);
    console.log('  ║                                      ║');
    console.log('  ║  按 Ctrl+C 关闭                      ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');

    // 自动打开浏览器
    const url = `http://localhost:${PORT}`;
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
  }).on('error', (err) => {
    console.error('');
    console.error('  ❌ 启动失败:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(` 端口 ${PORT} 已被占用，请关闭其他实例或修改端口`);
    }
    console.error('');
    console.error('  按任意键退出...');
    try {
      require('child_process').execSync('pause', { stdio: 'inherit' });
    } catch (_) {}
    process.exit(1);
  });
}

// 检查 public 目录是否存在
if (!fs.existsSync(publicPath)) {
  console.error('');
  console.error('  ❌ 找不到前端文件:', publicPath);
  console.error('  请确保 public/index.html 存在');
  console.error('');
  console.error('  按任意键退出...');
  try {
    require('child_process').execSync('pause', { stdio: 'inherit' });
  } catch (_) {}
  process.exit(1);
}

start();
