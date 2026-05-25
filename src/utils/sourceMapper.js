/**
 * 源码映射器 - 建立压缩代码字符偏移 ↔ 美化后行号的映射
 */

/**
 * 从源码中提取所有行起始偏移
 * @param {string} source
 * @returns {number[]} 每行的起始偏移数组，lineOffsets[0] = 第1行起始偏移
 */
function buildLineOffsets(source) {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * 根据字符偏移量获取行号和行内列号
 * @param {string} source 
 * @param {number} offset - 字符偏移量 (0-based)
 * @returns {{ line: number, col: number, lineStart: number, lineEnd: number }}
 */
function offsetToLineCol(source, offset) {
  if (offset < 0) offset = 0;
  if (offset >= source.length) offset = source.length - 1;

  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < source.length && i < offset; i++) {
    if (source[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }

  // 找到行尾
  let lineEnd = offset;
  while (lineEnd < source.length && source[lineEnd] !== '\n') lineEnd++;

  const col = offset - lineStart;

  return { line, col, lineStart, lineEnd };
}

/**
 * 获取目标行所在的行号范围
 * @param {string} source 
 * @param {number} lineNum - 1-based line number
 * @returns {{ start: number, end: number } | null}
 */
function getLineRange(source, lineNum) {
  let currentLine = 1;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if (currentLine === lineNum) {
      start = i;
      // 找到行尾
      while (i < source.length && source[i] !== '\n') i++;
      return { start, end: i };
    }
    if (source[i] === '\n') {
      currentLine++;
    }
  }
  // 如果请求的行号等于总行数+1（最后一行的下一行，不存在的行）
  if (lineNum === currentLine) {
    return { start: source.length, end: source.length };
  }
  return null;
}

/**
 * 从源码中截取上下文行
 * @param {string} source 
 * @param {number} targetOffset - 目标字符偏移量 (0-based)
 * @param {number} contextLines - 上下文行数
 * @returns {Array<{lineNum:number, content:string, isTarget:boolean, offset:number}>}
 */
function getContext(source, targetOffset, contextLines) {
  // 归一化换行符
  const normalized = source.replace(/\r\n/g, '\n');
  if (targetOffset < 0) targetOffset = 0;
  if (targetOffset >= normalized.length) targetOffset = normalized.length - 1;

  const lineOffsets = buildLineOffsets(normalized);

  // 找到目标偏移所在的行
  let targetLineIdx = 0; // 0-based index into lineOffsets
  for (let i = lineOffsets.length - 1; i >= 0; i--) {
    if (lineOffsets[i] <= targetOffset) {
      targetLineIdx = i;
      break;
    }
  }

  const targetLineNum = targetLineIdx + 1;
  const startLineIdx = Math.max(0, targetLineIdx - contextLines);
  const endLineIdx = Math.min(lineOffsets.length - 1, targetLineIdx + contextLines);

  const result = [];
  for (let i = startLineIdx; i <= endLineIdx; i++) {
    const lineStart = lineOffsets[i];
    const lineEnd = (i + 1 < lineOffsets.length)
      ? lineOffsets[i + 1] - 1 // 去掉换行符
      : normalized.length;
    const content = normalized.slice(lineStart, lineEnd < normalized.length ? lineEnd : normalized.length);
    result.push({
      lineNum: i + 1,
      content,
      isTarget: i === targetLineIdx,
      offset: lineStart,
    });
  }

  return {
    targetLine: targetLineNum,
    targetCol: targetOffset - lineOffsets[targetLineIdx],
    lines: result,
    totalLines: lineOffsets.length,
  };
}

module.exports = { buildLineOffsets, offsetToLineCol, getLineRange, getContext };
