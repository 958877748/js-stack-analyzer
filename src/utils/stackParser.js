/**
 * 堆栈解析器 - 解析各种格式的 JS 错误堆栈
 */

/**
 * 解析堆栈文本，提取帧信息
 * @param {string} text - 原始堆栈文本
 * @returns {Array<{raw:string, fn:string, url:string, line:number, col:number}>}
 */
function parseStack(text) {
  const frames = [];
  const lines = text.split('\n');

  // 支持多种堆栈格式
  // 注意: URL 中的 :// 包含冒号，所以不能用 [^\s:()] 排除冒号
  // 改用 [^\s()] 并配合 lazy 量词 +?，让正则引擎从短到长尝试直到匹配最后的 :line:col
  const patterns = [
    // Chrome/Edge: at fn (url:line:col)  or  at url:line:col
    /^\s*at\s+(?:(.+?)\s+\()?\s*((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)(?:\)|$|\s)/,
    // Chrome/Edge: at fn (url:line:col:col)  (某些场景有两个 col)
    /^\s*at\s+(?:(.+?)\s+\()?\s*((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+):(\d+)(?:\)|$|\s)/,
    // Safari: fn@url:line:col
    /^\s*(.+?)@((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)(?:\)|$|\s)/,
    // Firefox: fn@url:line:col
    /^\s*(.+?)\(((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)\)/,
    // Node.js: at fn (path:line:col) - 本地文件路径
    /^\s*at\s+(?:(.+?)\s+\()?\s*((?:\/|[A-Z]:\\)[^\s()]+?):(\d+):(\d+)(?:\)|$|\s)/,
  ];

  for (const line of lines) {
    for (const re of patterns) {
      const m = line.match(re);
      if (m) {
        frames.push({
          raw: line.trim(),
          fn: m[1] || '<anonymous>',
          url: m[2],
          line: parseInt(m[3], 10),
          col: parseInt(m[4], 10),
        });
        break;
      }
    }
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
