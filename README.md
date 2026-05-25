# JS 堆栈解析器

根据错误堆栈中的 `url:line:col`，在对应的 JS 文件中**精确定位到源码位置**，并展示该位置周围的上下文代码，支持**原始压缩代码**和**美化后代码**两种视图。

---

## 架构

```
┌─────────────────────────────────────────────────┐
│                  前端 (浏览器)                    │
│  public/index.html                              │
│  - 粘贴堆栈 / 粘贴源码                           │
│  - 帧列表展开/折叠                              │
│  - 原始视图 / 美化后视图 切换                    │
└──────────────┬──────────────────────────────────┘
               │  API 调用 (HTTP)
               ▼
┌─────────────────────────────────────────────────┐
│                 后端 (Node.js)                    │
│  server.js  ───  Express 服务入口                │
│  src/routes/api.js  ───  API 路由               │
│  src/services/                                    │
│    ├─ fetcher.js    ───  从 URL 下载源码          │
│    └─ beautifier.js ───  代码美化 + 偏移映射      │
│  src/utils/                                       │
│    ├─ stackParser.js ───  堆栈解析                │
│    └─ sourceMapper.js ───  源码行/列/偏移计算     │
└─────────────────────────────────────────────────┘
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 打开浏览器访问
# http://localhost:3020
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/parse` | 解析堆栈文本，返回帧列表 |
| POST | `/api/fetch-source` | 从 URL 下载源码（服务端，无 CORS 限制） |
| POST | `/api/beautify` | 美化压缩代码，建立偏移→行号映射 |
| POST | `/api/context` | 获取原始代码上下文（按字符偏移） |
| POST | `/api/pretty-context` | 获取美化后代码上下文（偏移→行号映射） |
| GET | `/api/cache-status` | 查看缓存状态 |
| POST | `/api/clear-cache` | 清除后端缓存 |

## 核心功能

### 1. 堆栈解析
- 支持 Chrome/Edge、Safari、Firefox、Node.js 等多种堆栈格式
- 正则提取: `fn`, `url`, `line`, `col`
- 按 URL 分组，便于批量处理

### 2. 代码定位策略

#### 场景 A: 单行压缩文件（line=1, col 很大）
- `col` 直接作为**字符偏移量**
- 后端自动使用 `js-beautify` 美化代码
- 建立 **原始偏移 → 美化后 (行, 列)** 映射表
- 前端可在「原始视图」和「美化后视图」之间切换

#### 场景 B: 普通多行文件
- 按 `line` 定位行号
- 展示 `[line-N, line+N]` 行，高亮目标行和列

### 3. 交互方式
- 帧列表显示: `序号 | 函数名 | 文件(短) | 行:列 [→ 美化后行:列]`
- 点击展开/折叠，显示上下文代码
- 美化后代码可读性更好，行号可与 Chrome DevTools 对照
- 支持展开/折叠全部
- 可调节上下文行数

### 4. 源码加载
- 手动粘贴
- 从 URL 自动 fetch（后端下载，无 CORS 限制）
- 自动缓存已下载的文件（30 分钟有效）

## 技术栈

- **前端**: 原生 HTML/CSS/JS，深色 Catppuccin 主题
- **后端**: Node.js + Express
- **关键依赖**: `js-beautify` (代码美化)
- **字体**: Cascadia Code / Fira Code / JetBrains Mono

## 设计思路

### 核心问题

> `TypeError: String(...).padStart is not a function at e.getFormatCountdown (https://...js:1:882872)`

堆栈格式为 `at fnName (url:line:col)`，对于单行压缩文件（`line=1`），`col` 实际上是**字符偏移量**。需要根据该偏移量定位到源码中的具体位置。

### 为什么需要后端？

| 任务 | 前端限制 | 后端优势 |
|------|----------|----------|
| 从 URL 下载源码 | CORS 限制，大部分 CDN 不让跨域 | 无跨域问题 |
| 代码美化 (Pretty Print) | 浏览器端性能差，大文件卡死 | 服务端处理，可缓存 |
| 偏移→行号映射 | 每次展开重新计算 O(n) | 缓存映射表 O(1) |
| 大文件缓存 | 每次刷新页面丢失 | 内存缓存，持久化 |

### 对照 Chrome DevTools

生产环境压缩文件通常只有一行，但在 DevTools 中点击 `{}`（Pretty Print）后可读。本工具模拟了这一流程：

1. 从 URL 下载原始压缩代码
2. 使用 `js-beautify` 美化
3. 建立 `原始字符偏移 → 美化后 (行, 列)` 映射
4. 在美化后的代码上展示上下文，行号可与 DevTools 对照
