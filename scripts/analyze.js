#!/usr/bin/env node
/**
 * JS 堆栈分析 CLI
 * 用法: node scripts/analyze.js "<堆栈>"
 * 或: cat stack.txt | node scripts/analyze.js
 */
const path = require('path');
const root = path.resolve(__dirname, '..');

const { parseStack } = require(path.join(root, 'src/utils/stackParser'));
const { fetchSource } = require(path.join(root, 'src/services/fetcher'));
const { beautifySource, findPrettyPosition, getPrettyContext } = require(path.join(root, 'src/services/beautifier'));

async function analyze(stackText, contextLines = 10) {
  const frames = parseStack(stackText);
  if (frames.length === 0) return '❌ 未识别到堆栈帧';

  const groups = {};
  for (const f of frames) {
    if (!groups[f.url]) groups[f.url] = [];
    groups[f.url].push(f);
  }

  let result = `📋 ${frames.length} 帧, ${Object.keys(groups).length} 个文件\n\n`;

  for (const [url, fileFrames] of Object.entries(groups)) {
    const fileName = url.split('/').pop().split('?')[0];
    result += `📄 ${fileName}\n`;

    const { content } = await fetchSource(url);
    const mapping = beautifySource(content);
    const totalLines = mapping.pretty.split('\n').length;
    const sizeKB = (content.length / 1024).toFixed(0);
    result += `   大小 ${sizeKB}KB, 美化后 ${totalLines} 行\n`;

    for (const f of fileFrames) {
      const pos = findPrettyPosition(mapping, f.col);
      const ctx = getPrettyContext(mapping.pretty, pos.prettyLine, pos.prettyCol, contextLines);
      const targetLine = ctx.lines.find(l => l.isTarget);

      result += `  # ${f.fn || '<anonymous>'}\n`;
      result += `    偏移 ${f.line}:${f.col} → ${pos.prettyLine}:${pos.prettyCol} ${pos.confidence === 'exact' ? '✅' : '⚠️'}\n`;
      if (targetLine) {
        result += `    ${targetLine.content.substring(0, 150)}\n`;
      }
      result += '\n';
    }
  }

  return result;
}

// 入口
const stack = process.argv[2];
const contextLines = parseInt(process.argv[3], 10) || 5;

if (stack) {
  analyze(stack, contextLines).then(r => console.log(r)).catch(e => console.error('❌', e.message));
} else {
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    const s = d.trim();
    if (s) analyze(s, contextLines).then(r => console.log(r)).catch(e => console.error('❌', e.message));
    else console.log('用法: node scripts/analyze.js "<堆栈>" [上下文行数]');
  });
}
