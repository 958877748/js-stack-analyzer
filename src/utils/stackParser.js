/**
 * 堆栈解析器 - 解析各种格式的 JS 错误堆栈
 */

/**
 * 解析堆栈文本，提取帧信息
 * 
 * 支持格式：
 *   Chrome:  at fn (url:line:col)  /  at url:line:col
 *   多行:     Error\n    at fn (url:line:col)\n
 *   单行:     Error at fn (url:line:col) at fn2 (url:line:col)
 *   Safari:   fn@url:line:col
 *   Safari:   @url:line:col  (无函数名)
 *   Firefox:  fn(url:line:col)
 *
 * @param {string} text - 原始堆栈文本
 * @returns {Array<{raw:string, fn:string, url:string, line:number, col:number}>}
 */
function parseStack(text) {
  const frames = [];

  // 多个全局正则，依次尝试
  const patterns = [
    // Chrome/Node: at fn (url:line:col) 或 at url:line:col
    /at\s+(?:(.+?)\s+\()?\s*((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)/g,
    // Safari: fn@url:line:col
    /([^\s@()]+)@\s*((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)/g,
    // Safari: @url:line:col (无函数名, @必须在行首或空格后)
    /(?:^|\s)@\s*((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)/gm,
    // Firefox: fn(url:line:col)
    /([^\s()]+)\(((?:https?|ftp):\/\/[^\s()]+?):(\d+):(\d+)\)/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      // Chrome:  [full, fn?, url, line, col]
      // Safari fn@: [full, fn, url, line, col]
      // Safari @:  [full, url, line, col]  (无 fn 分组)
      // Firefox:   [full, fn, url, line, col]

      // match[match.length-3] = url, match[match.length-2] = line, match[match.length-1] = col
      const url = match[match.length - 3];
      const line = parseInt(match[match.length - 2], 10);
      const col = parseInt(match[match.length - 1], 10);

      // 判断是否有函数名:
      // match.length=4 (Safari @): [full, url, line, col] → 无 fn
      // match.length>=5: [full, fn?, url, line, col] → fn = match[1] 如果存在
      const fn = (match.length >= 5 && typeof match[1] === 'string' && match[1].length > 0)
        ? match[1].trim() : '<anonymous>';

      // 避免重复
      const rawIdx = match.index;
      if (frames.some(f => f.url === url && f.col === col && f._idx === rawIdx)) continue;

      frames.push({
        raw: match[0],
        fn,
        url,
        line,
        col,
        _idx: rawIdx,
      });
    }
  }

  // 按在文本中出现顺序排序
  frames.sort((a, b) => a._idx - b._idx);

  // 去掉内部属性
  return frames.map(({ _idx, ...rest }) => rest);
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
