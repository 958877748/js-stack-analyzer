/**
 * JS 堆栈解析器 - 后端服务
 * 
 * 提供 API:
 *   POST /api/parse          - 解析堆栈文本
 *   POST /api/fetch-source   - 从 URL 下载源码（无 CORS 限制）
 *   POST /api/beautify       - 美化压缩代码并建立映射
 *   POST /api/context        - 获取上下文代码（原始偏移模式）
 *   POST /api/pretty-context - 获取美化后的上下文代码
 *   GET  /api/cache-status   - 查看缓存状态
 *   POST /api/clear-cache    - 清除缓存
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3020;

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '100mb' })); // 支持大文件上传
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// API 路由
app.use('/api', apiRoutes);

// 静态文件 - 前端页面
app.use(express.static(path.join(__dirname, 'public')));

// 根路径重定向到 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动
app.listen(PORT, () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  JS 堆栈解析器 后端服务已启动`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});
