---
name: js-stack-analyzer
description: >
  JavaScript error stack analyzer. Downloads minified JS source files from URLs,
  beautifies them, and maps character offsets to exact source locations with syntax-highlighted code context.
  Use whenever the user pastes a JS error stack trace and asks for analysis.
---

# JS Stack Analyzer

## 启动服务

如果服务未运行，先启动：

```bash
cd /path/to/js-stack-analyzer && node server.js &
```

服务默认在 `http://localhost:3020`。

## 分析堆栈流程

### 1. 解析堆栈

将用户给的堆栈发送给解析 API：

```bash
curl -s http://localhost:3020/api/parse \
  -H "Content-Type: application/json" \
  -d '{"stack":"<用户粘贴的完整堆栈>"}'
```

返回示例：

```json
{
  "count": 9,
  "frames": [
    { "fn": "t.getUIdata", "url": "https://...index.615df.js", "line": 1, "col": 813928 },
    ...
  ],
  "groups": { "url1": [...], "url2": [...] }
}
```

### 2. 下载源码

对每个唯一的 URL 下载源码（后端自动缓存，重复下载秒回）：

```bash
curl -s http://localhost:3020/api/fetch-source \
  -H "Content-Type: application/json" \
  -d '{"url":"<文件URL>"}'
```

### 3. 获取美化后代码上下文

对每一帧，获取美化后的代码上下文：

```bash
curl -s http://localhost:3020/api/pretty-context \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<帧所属的文件URL>",
    "rawOffset": <col值>,
    "contextLines": 10
  }'
```

返回包含：
- `mappedPosition.prettyLine` — 美化后的行号
- `mappedPosition.prettyCol` — 美化后的列号
- `lines[]` — 上下文代码行（`isTarget` 标记目标行）
- `lines[].content` — 代码内容（已语法高亮）

### 4. 批量获取映射

一次请求获取所有帧的美化后位置：

```bash
curl -s http://localhost:3020/api/pretty-context-batch \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<文件URL>",
    "offsets": [<col1>, <col2>, ...],
    "contextLines": 0
  }'
```

### 5. 呈现结果

向用户展示：

- **错误信息**：堆栈的第一行
- **帧列表**：每帧的函数名、文件、原始偏移 → 美化后行号
- **代码上下文**：目标行用黄色高亮标注 `←`，附带语法高亮

## 快速分析脚本

一键分析整个堆栈：

```bash
# 1. 先把堆栈保存到变量
STACK='<用户粘贴的堆栈>'

# 2. 解析
PARSE=$(curl -s http://localhost:3020/api/parse -H "Content-Type: application/json" -d "{\"stack\":$(echo "$STACK" | jq -Rs .)}")
echo "$PARSE" | jq '.frames[] | {fn, url: (.url | split("/") | last), col}'

# 3. 下载并获取所有帧的上下文（用 jq 处理）
echo "$PARSE" | jq -r '.groups | to_entries[] | .key' | while read url; do
  echo "=== $url ==="
  curl -s http://localhost:3020/api/pretty-context-batch \
    -H "Content-Type: application/json" \
    -d "{\"url\":$(echo "$url" | jq -Rs .),\"offsets\":[$(echo "$PARSE" | jq "[.groups[\"$url\"][].col]" | jq -c . | tr -d '[]')],\"contextLines\":5}"
done
```

## 注意事项

- 堆栈可以是多行或单行格式（`at fn (url:line:col) at fn2 ...`）
- 支持 Chrome/Edge/Safari/Firefox/Node.js 格式
- 同一个 URL 只会下载一次（后端缓存 30 分钟）
- `col` 值直接作为字符偏移量，对于单行压缩文件即精确位置
- 美化后代码带有 Chrome DevTools 风格的语法高亮
