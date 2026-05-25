/**
 * 代码美化服务 - Pretty Print 压缩 JS，并建立偏移映射
 * 
 * 核心思路：非空白字符对齐
 * js-beautify 只改变空白（添加换行/缩进），非空白字符顺序不变。
 * 因此：原始偏移 → 第N个非空白字符 → 美化后位置
 */
const beautify = require('js-beautify');

function isWs(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

/**
 * 构建非空白字符偏移索引表
 */
function buildNonWsIndex(text) {
  const indices = [];
  for (let i = 0; i < text.length; i++) {
    if (!isWs(text[i])) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * 构建行起始偏移表
 */
function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

/**
 * 将字符偏移转为行号和列号
 */
function offsetToLineCol(offset, lineStarts) {
  if (offset < 0 || !lineStarts || lineStarts.length === 0) {
    return { line: 1, col: 0 };
  }
  let lo = 0, hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - lineStarts[lo] };
}

/**
 * 美化 JS 代码
 */
function beautifySource(source) {
  const raw = source.replace(/\r\n/g, '\n');
  const newlineCount = (raw.match(/\n/g) || []).length;
  const isMinified = raw.length > 5000 && newlineCount < 20;

  let pretty;
  if (isMinified) {
    pretty = beautify.js(raw, {
      indent_size: 2,
      indent_char: ' ',
      preserve_newlines: false,
      max_preserve_newlines: 1,
      keep_function_indentation: false,
      wrap_line_length: 120,
      end_with_newline: false,
    });
  } else {
    pretty = raw;
  }

  // 构建非空白字符索引表
  const rawNonWs = buildNonWsIndex(raw);
  const prettyNonWs = buildNonWsIndex(pretty);

  // 验证：非空白字符数量应一致
  // 如果不一致，说明 beautifier 改变了语义字符，需要 fallback
  const nonWsMatch = rawNonWs.length === prettyNonWs.length;

  // 构建行起始偏移表（美化后）
  const lineStarts = buildLineStarts(pretty);

  return {
    pretty,
    rawLength: raw.length,
    prettyLength: pretty.length,
    isMinified,
    rawNonWs,
    prettyNonWs,
    lineStarts,
    nonWsMatch,
  };
}

/**
 * 根据原始偏移量查找美化后的位置
 * 
 * @param {object} mapping - beautifySource 返回的结果
 * @param {number} rawOffset - 原始文件中的字符偏移 (0-based)
 * @returns {{ prettyLine: number, prettyCol: number, prettyOffset: number, confidence: string }}
 */
function findPrettyPosition(mapping, rawOffset) {
  if (!mapping || !mapping.rawNonWs) {
    return { prettyLine: 1, prettyCol: 0, prettyOffset: 0, confidence: 'none' };
  }

  const { rawNonWs, prettyNonWs, lineStarts, rawLength, nonWsMatch } = mapping;

  // 边界情况
  if (rawOffset <= 0) {
    const pos = prettyNonWs[0];
    const { line, col } = offsetToLineCol(pos, lineStarts);
    return { prettyLine: line, prettyCol: col, prettyOffset: pos, confidence: 'exact' };
  }
  if (rawOffset >= rawLength - 1) {
    const pos = prettyNonWs[prettyNonWs.length - 1];
    const { line, col } = offsetToLineCol(pos, lineStarts);
    return { prettyLine: line, prettyCol: col, prettyOffset: pos, confidence: 'exact' };
  }

  // 情况 1: rawOffset 指向一个非空白字符
  // 在 rawNonWs 中二分查找
  let lo = 0, hi = rawNonWs.length - 1;
  let exactMatch = false;

  // 先检查 raw[rawOffset] 是不是非空白字符
  // 但我们没有 raw 字符串本身，用 rawNonWs 来判断
  // 如果 rawOffset 刚好是 rawNonWs 中的一个值，那就是精确的非空白字符
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (rawNonWs[mid] === rawOffset) {
      // 精确匹配
      const prettyPos = prettyNonWs[mid];
      const { line, col } = offsetToLineCol(prettyPos, lineStarts);
      return { prettyLine: line, prettyCol: col, prettyOffset: prettyPos, confidence: 'exact' };
    }
    if (rawNonWs[mid] < rawOffset) lo = mid + 1;
    else hi = mid - 1;
  }

  // 情况 2: rawOffset 指向空白字符（在压缩代码中很少见，但可能出现在字符串中）
  // hi 是最后一个小于 rawOffset 的非空白字符索引
  // lo 是第一个大于 rawOffset 的非空白字符索引
  // 我们取最近的映射点

  if (hi < 0) {
    // rawOffset 在所有非空白字符之前
    const pos = prettyNonWs[0];
    const { line, col } = offsetToLineCol(pos, lineStarts);
    return { prettyLine: line, prettyCol: col, prettyOffset: pos, confidence: 'approximate' };
  }

  if (lo >= rawNonWs.length) {
    // rawOffset 在所有非空白字符之后
    const pos = prettyNonWs[prettyNonWs.length - 1];
    const { line, col } = offsetToLineCol(pos, lineStarts);
    return { prettyLine: line, prettyCol: col, prettyOffset: pos, confidence: 'approximate' };
  }

  // 取最近的非空白字符
  const prevRaw = rawNonWs[hi];
  const nextRaw = rawNonWs[lo];
  const distToPrev = rawOffset - prevRaw;
  const distToNext = nextRaw - rawOffset;

  let chosenNonWsIndex;
  if (distToPrev <= distToNext) {
    chosenNonWsIndex = hi;
  } else {
    chosenNonWsIndex = lo;
  }

  const prettyPos = prettyNonWs[chosenNonWsIndex];
  const { line, col } = offsetToLineCol(prettyPos, lineStarts);
  return {
    prettyLine: line,
    prettyCol: col,
    prettyOffset: prettyPos,
    confidence: 'approximate',
    nearestRawOffset: rawNonWs[chosenNonWsIndex],
    offsetDiff: rawOffset - rawNonWs[chosenNonWsIndex],
  };
}

/**
 * 获取美化后代码的上下文
 */
function getPrettyContext(prettyCode, prettyLine, prettyCol, contextLines) {
  const normalized = prettyCode.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const startLine = Math.max(0, prettyLine - 1 - contextLines);
  const endLine = Math.min(lines.length, prettyLine - 1 + contextLines);

  const resultLines = [];
  for (let i = startLine; i < endLine; i++) {
    resultLines.push({
      lineNum: i + 1,
      content: lines[i] || '',
      isTarget: i === prettyLine - 1,
    });
  }

  return {
    targetLine: prettyLine,
    targetCol: prettyCol,
    lines: resultLines,
    totalLines: lines.length,
  };
}

module.exports = { beautifySource, findPrettyPosition, getPrettyContext };
