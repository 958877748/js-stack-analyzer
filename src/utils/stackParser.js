/**
 * 堆栈解析器 - 解析各种格式的 JS 错误堆栈
 */

/**
 * 解析堆栈文本，提取帧信息
 * 
 * 支持多行和单行两种格式：
 *   多行: Error: msg\n    at fn (url:line:col)\n    at fn2 (url:line:col)\n
 *   单行: Error: msg at fn (url:line:col) at fn2 (url:line:col)
 *
 * @param {string} text - 原始堆栈文本
 * @returns {Array<{raw:string, fn:string, url:string, line:number, col:number}>}
 */
function parseStack(text) {
  const frames = [];

  // 统一的正则：全局匹配所有 "at fn (url:line:col)" 模式
  // 不依赖行首锚点 ^，可以在文本任意位置匹配
  // 使用全局 g 标志一次找出所有帧
  const globalRe = /at\s+(?:(.+?)\s+\()?\s*((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)/g;

  let match;
  while ((match = globalRe.exec(text)) !== null) {
    frames.push({
      raw: match[0],
      fn: (match[1] || '<anonymous>').trim(),
      url: match[2],
      line: parseInt(match[3], 10),
      col: parseInt(match[4], 10),
    });
  }

  return frames;
}

/**
 * 按 URL 对帧进行分组
 */
function groupByUrl(frames) {
  const groups = {};
  for (const f of frames) {
    if (!groups[f.url]) groups[f.url] = [];
    groups[f.url].push(f);
  }
  return groups;
}

module.exports = { parseStack, groupByUrl };
