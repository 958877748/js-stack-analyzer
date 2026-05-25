#!/usr/bin/env bash
# JS 堆栈分析脚本
# 用法: echo "<堆栈>" | ./scripts/analyze.sh
# 或: ./scripts/analyze.sh < 堆栈文件

API="http://localhost:3020/api"

# 读取堆栈
if [ -t 0 ]; then
  # 从参数读
  STACK="$*"
else
  # 从 stdin 读
  STACK=$(cat)
fi

if [ -z "$STACK" ]; then
  echo "❌ 请提供堆栈内容"
  exit 1
fi

echo "📋 解析堆栈..."

# 1. 解析
PARSE=$(curl -s "$API/parse" -H "Content-Type: application/json" -d "{\"stack\":$(echo "$STACK" | jq -Rs .)}")
COUNT=$(echo "$PARSE" | jq '.count')

if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
  echo "❌ 未识别到堆栈帧"
  exit 1
fi

echo "✅ 识别到 $COUNT 帧"
echo ""

# 2. 逐文件处理
echo "$PARSE" | jq -c '.groups | to_entries[]' | while read entry; do
  URL=$(echo "$entry" | jq -r '.key')
  FILENAME=$(echo "$URL" | awk -F/ '{print $NF}' | awk -F? '{print $1}')
  OFFSETS=$(echo "$entry" | jq '[.value[].col]')
  
  echo "📄 $FILENAME ($(echo "$OFFSETS" | jq 'length') 帧)"
  
  # 下载源码
  DOWNLOAD=$(curl -s "$API/fetch-source" -H "Content-Type: application/json" -d "{\"url\":$(echo "$URL" | jq -Rs .)}")
  SIZE=$(echo "$DOWNLOAD" | jq '.size')
  echo "   下载: $(echo "scale=1; $SIZE/1024/1024" | bc)MB"
  
  # 批量映射
  BATCH=$(curl -s "$API/pretty-context-batch" \
    -H "Content-Type: application/json" \
    -d "{\"url\":$(echo "$URL" | jq -Rs .),\"offsets\":$OFFSETS,\"contextLines\":5}")
  
  TOTAL_LINES=$(echo "$BATCH" | jq '.totalLines')
  echo "   美化后: ${TOTAL_LINES} 行"
  
  # 列出每帧
  echo "$BATCH" | jq -c '.results[]' | while read result; do
    RAW_OFFSET=$(echo "$result" | jq '.rawOffset')
    LINE=$(echo "$result" | jq '.mappedPosition.prettyLine')
    COL=$(echo "$result" | jq '.mappedPosition.prettyCol')
    CONF=$(echo "$result" | jq -r '.mappedPosition.confidence')
    
    # 找函数名
    FN=$(echo "$PARSE" | jq -r ".frames[] | select(.col==$RAW_OFFSET) | .fn")
    
    echo "   # $FN"
    echo "     偏移 $RAW_OFFSET → 第 ${LINE} 行, 第 ${COL} 列 (${CONF})"
    
    # 显示上下文
    if [ "$(echo "$result" | jq '.context')" != "null" ]; then
      echo "$result" | jq -c '.context[]' | while read line; do
        IS_TARGET=$(echo "$line" | jq '.isTarget')
        NUM=$(echo "$line" | jq '.lineNum')
        CONTENT=$(echo "$line" | jq -r '.content' | head -c 120)
        if [ "$IS_TARGET" = "true" ]; then
          echo "     → $NUM: $CONTENT"
        else
          echo "       $NUM: $CONTENT"
        fi
      done
    fi
    echo ""
  done
done
