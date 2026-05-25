---
name: js-stack-analyzer
description: >
  JavaScript error stack analyzer. Directly requires Node.js modules to parse stacks,
  download minified source files from URLs, beautify them, and map character offsets
  to exact source locations. Use whenever the user pastes a JS error stack trace.
---

# JS Stack Analyzer

## 项目结构（AI 所需部分）

```
js-stack-analyzer/
├── src/
│   ├── utils/stackParser.js     ← parseStack(text) 解析堆栈
│   ├── services/fetcher.js      ← fetchSource(url) 下载源码
│   └── services/beautifier.js   ← beautifySource() / findPrettyPosition() / getPrettyContext()
└── scripts/analyze.js           ← CLI 工具
```

## 直接 require 模块分析

```javascript
const { parseStack } = require('./src/utils/stackParser');
const { fetchSource } = require('./src/services/fetcher');
const { beautifySource, findPrettyPosition, getPrettyContext } = require('./src/services/beautifier');

// 1. 解析堆栈 → [{ fn, url, line, col }]
const frames = parseStack(stackText);

// 2. 按 URL 分组，逐个下载 + 美化
const groups = {};
for (const f of frames) groups[f.url] ??= [];
for (const f of frames) groups[f.url].push(f);

for (const [url, fileFrames] of Object.entries(groups)) {
  const { content } = await fetchSource(url);               // 下载
  const mapping = beautifySource(content);                  // 美化 + 建映射
  for (const f of fileFrames) {
    const pos = findPrettyPosition(mapping, f.col);         // 偏移 → 行:列
    const ctx = getPrettyContext(mapping.pretty, pos.prettyLine, pos.prettyCol, 10);
    // ctx.lines: [{ lineNum, content, isTarget }]          // 上下文代码
  }
}
```

## CLI 快速分析

```bash
node scripts/analyze.js "<堆栈文本>"
cat stack.txt | node scripts/analyze.js
```

## 支持格式

- Chrome/Edge: `at fn (url:line:col)` / `at url:line:col`
- Safari: `fn@url:line:col` / `@url:line:col`
- Firefox: `fn(url:line:col)`
- 单行或多行均可
