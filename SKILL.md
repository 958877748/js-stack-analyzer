---
name: js-stack-analyzer
description: >
  JavaScript error stack analyzer. Directly uses Node.js modules to download minified JS source files,
  beautify them, and map character offsets to exact source locations.
  Use whenever the user pastes a JS error stack trace.
---

# JS Stack Analyzer

直接调用项目中的 JS 模块分析堆栈，**不需要启动服务器**。

## 核心模块

| 模块 | 功能 |
|------|------|
| `src/utils/stackParser.js` | 解析堆栈文本为帧列表 |
| `src/services/fetcher.js` | 从 URL 下载源码文件 |
| `src/services/beautifier.js` | 美化压缩代码，建立偏移映射，获取上下文 |

## 分析流程

### 1. 解析堆栈

```javascript
const { parseStack } = require('./src/utils/stackParser');

const frames = parseStack(stackText);
// 返回: [{ fn, url, line, col }, ...]
```

`stackText` 可以是多行或单行格式，都支持。

### 2. 下载源码

```javascript
const { fetchSource } = require('./src/services/fetcher');

const result = await fetchSource(url);
const sourceCode = result.content;  // 原始 JS 源码字符串
```

注意 `fetchSource` 是异步的，需要用 `await`。

### 3. 美化 + 建立映射

```javascript
const { beautifySource, findPrettyPosition, getPrettyContext } = require('./src/services/beautifier');

const mapping = beautifySource(sourceCode);
// mapping = { pretty, isMinified, rawNonWs, prettyNonWs, lineStarts, ... }
```

- `mapping.pretty` — 美化后的多行代码
- `mapping.isMinified` — 是否压缩文件
- `mapping.rawNonWs` / `mapping.prettyNonWs` — 非空白字符索引表

### 4. 定位偏移 → 美化后位置

```javascript
const pos = findPrettyPosition(mapping, rawOffset);
// pos = { prettyLine, prettyCol, confidence }
// confidence: 'exact' 精确 | 'approximate' 近似
```

### 5. 获取代码上下文

```javascript
const ctx = getPrettyContext(mapping.pretty, pos.prettyLine, pos.prettyCol, contextLines);
// ctx = { targetLine, targetCol, lines: [{ lineNum, content, isTarget }], totalLines }
```

## 方式一：直接 require 模块（推荐给 AI 使用）

```javascript
const { parseStack } = require('./src/utils/stackParser');
const { fetchSource } = require('./src/services/fetcher');
const { beautifySource, findPrettyPosition, getPrettyContext } = require('./src/services/beautifier');

// 1. 解析
const frames = parseStack(stackText);

// 2. 对每个文件下载 + 美化 + 映射
const groups = {};
for (const f of frames) {
  if (!groups[f.url]) groups[f.url] = [];
  groups[f.url].push(f);
}

for (const [url, fileFrames] of Object.entries(groups)) {
  // 下载
  const { content } = await fetchSource(url);
  // 美化
  const mapping = beautifySource(content);
  // 对每一帧定位
  for (const f of fileFrames) {
    const pos = findPrettyPosition(mapping, f.col);
    const ctx = getPrettyContext(mapping.pretty, pos.prettyLine, pos.prettyCol, 10);
    // ctx.lines 就是带语法高亮的上下文代码
  }
}
```

## 方式二：用 CLI 脚本（命令行快速分析）

```bash
node scripts/analyze.js "<堆栈文本>"
```

或者从文件/管道读取：

```bash
cat stack.txt | node scripts/analyze.js
```

脚本会自动下载源码、美化、定位、输出结果。

## 注意事项

- `fetchSource()` 是异步的，记得用 `await`
- 同一个 URL 第二次调用 `fetchSource()` 会走缓存（内存缓存 30 分钟）
- `beautifySource()` 对非压缩文件（行数 > 20）直接返回原文本，不美化
- 映射精度：当 `confidence === 'exact'` 时为精确匹配（非空白字符对齐），否则为估算值
- `col` 值在单行压缩文件中就是字符偏移量，直接传给 `findPrettyPosition`
