# JS 堆栈解析器

解析 JavaScript 错误堆栈，自动下载源码、美化压缩代码、定位到精确行号。

## 快速开始

```bash
npm install
node server.js
# 打开 http://localhost:3020
```

## CLI 分析

```bash
node scripts/analyze.js "<堆栈>" [上下文行数]
```

示例：

```bash
node scripts/analyze.js "TypeError: x at fn (https://example.com/a.js:1:100)"
```

## 项目结构

```
├── src/
│   ├── utils/stackParser.js     解析堆栈
│   ├── services/fetcher.js      下载源码
│   └── services/beautifier.js   美化 + 偏移映射
├── scripts/analyze.js           CLI 工具
├── public/index.html            前端页面
├── server.js                    HTTP 服务
├── SKILL.md                     pi skill
└── package.json
```

## 支持格式

- Chrome/Edge: `at fn (url:line:col)`
- Safari: `fn@url:line:col` / `@url:line:col`
- Firefox: `fn(url:line:col)`
- 单行或多行均可

## 构建 EXE

```bash
npm run build
```
