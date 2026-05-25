---
name: js-stack-analyzer
description: >
  JavaScript error stack analyzer. Use when the user pastes a JS error stack trace.
  Calls scripts/analyze.js to parse stacks, download source, and locate code.
---

# JS Stack Analyzer

## CLI

```bash
node scripts/analyze.js "<堆栈>"
```

把堆栈传给脚本，自动下载源码、美化、定位，输出分析结果。
