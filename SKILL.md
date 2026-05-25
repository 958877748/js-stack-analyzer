---
name: js-stack-analyzer
description: >
  JavaScript error stack analyzer. Use when the user pastes a JS error stack trace.
  Calls scripts/analyze.js with the stack text to parse, download source, and locate code.
---

# JS Stack Analyzer

## CLI

```bash
node scripts/analyze.js "<堆栈>" [上下文行数]
```

- 参数1: 堆栈文本（必填，或用管道传入）
- 参数2: 上下文行数（可选，默认 5）

### 示例

```bash
node scripts/analyze.js "TypeError: x at fn (https://example.com/a.js:1:100)"
node scripts/analyze.js "$(pbpaste)" 10
echo "<堆栈>" | node scripts/analyze.js
```

脚本自动完成：解析堆栈 → 下载源码 → 美化 → 定位 → 输出代码上下文。
