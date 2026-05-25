---
name: js-stack-analyzer
description: >
  JavaScript error stack analyzer. Directly requires Node.js modules to parse stacks,
  download minified source files from URLs, beautify them, and map character offsets
  to exact source locations. Use whenever the user pastes a JS error stack trace.
---

# JS Stack Analyzer

## 使用方式

### 直接 require 模块

```javascript
const { parseStack } = require('./src/utils/stackParser');
const { fetchSource } = require('./src/services/fetcher');
const { beautifySource, findPrettyPosition, getPrettyContext } = require('./src/services/beautifier');

const frames = parseStack(stackText);

const groups = {};
for (const f of frames) groups[f.url] ??= [];
for (const f of frames) groups[f.url].push(f);

for (const [url, fileFrames] of Object.entries(groups)) {
  const { content } = await fetchSource(url);
  const mapping = beautifySource(content);
  for (const f of fileFrames) {
    const pos = findPrettyPosition(mapping, f.col);
    const ctx = getPrettyContext(mapping.pretty, pos.prettyLine, pos.prettyCol, 10);
  }
}
```

### CLI 工具

```bash
node scripts/analyze.js "<堆栈>"
echo "<堆栈>" | node scripts/analyze.js
```

## 支持格式

Chrome / Safari / Firefox / 单行或多行
