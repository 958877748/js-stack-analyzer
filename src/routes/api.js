/**
 * API 路由
 */
const express = require('express');
const router = express.Router();

const { parseStack, groupByUrl } = require('../utils/stackParser');
const { getContext } = require('../utils/sourceMapper');
const { beautifySource, findPrettyPosition, getPrettyContext } = require('../services/beautifier');
const { fetchSource, getMainSourceUrl } = require('../services/fetcher');

// 内存缓存：url -> { content, pretty, mappingResult, timestamp }
const sourceCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟

/**
 * 解析源码参数：优先用 body.source，否则从缓存中通过 body.url 查找
 */
function resolveSource(req) {
  const { source, url } = req.body;
  if (source) return source;
  if (url) {
    const cached = sourceCache.get(url);
    if (cached && cached.content) return cached.content;
  }
  return null;
}

/**
 * POST /api/parse
 * 解析堆栈文本，返回帧列表
 */
router.post('/parse', (req, res) => {
  try {
    const { stack } = req.body;
    if (!stack) {
      return res.status(400).json({ error: '缺少 stack 参数' });
    }
    const frames = parseStack(stack);
    const groups = groupByUrl(frames);
    res.json({ frames, groups, count: frames.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/fetch-source
 * 从 URL 下载源码（服务端，无 CORS 限制）
 */
router.post('/fetch-source', async (req, res) => {
  try {
    const { url: sourceUrl } = req.body;
    if (!sourceUrl) {
      return res.status(400).json({ error: '缺少 url 参数' });
    }

    // 检查缓存
    const cached = sourceCache.get(sourceUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        content: cached.content,
        url: sourceUrl,
        size: cached.content.length,
        cached: true,
      });
    }

    const result = await fetchSource(sourceUrl);

    // 写入缓存
    sourceCache.set(sourceUrl, {
      content: result.content,
      timestamp: Date.now(),
    });

    res.json({
      content: result.content,
      url: result.url,
      size: result.size,
      cached: false,
    });
  } catch (e) {
    res.status(500).json({ error: `下载失败: ${e.message}` });
  }
});

/**
 * POST /api/beautify
 * 美化压缩代码，建立偏移映射
 */
router.post('/beautify', (req, res) => {
  try {
    const { code, url: sourceUrl } = req.body;
    if (!code) {
      return res.status(400).json({ error: '缺少 code 参数' });
    }

    // 检查缓存
    if (sourceUrl) {
      const cached = sourceCache.get(sourceUrl);
      if (cached && cached.mappingResult && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json({
          pretty: cached.pretty,
          isMinified: cached.mappingResult.isMinified,
          mapping: {
            prettyLength: cached.mappingResult.prettyLength,
            rawLength: cached.mappingResult.rawLength,
            isMinified: cached.mappingResult.isMinified,
            nonWsMatch: cached.mappingResult.nonWsMatch,
          },
          cached: true,
        });
      }
    }

    const mappingResult = beautifySource(code);
    const isMinified = mappingResult.isMinified;

    // 写入缓存
    if (sourceUrl) {
      const entry = sourceCache.get(sourceUrl) || {};
      entry.pretty = mappingResult.pretty;
      entry.mappingResult = mappingResult;
      entry.timestamp = Date.now();
      sourceCache.set(sourceUrl, entry);
    }

    // 不返回完整的索引表（太大），只返回元数据
    res.json({
      pretty: mappingResult.pretty,
      isMinified,
      mapping: {
        prettyLength: mappingResult.prettyLength,
        rawLength: mappingResult.rawLength,
        isMinified,
        nonWsMatch: mappingResult.nonWsMatch,
      },
      cached: false,
    });
  } catch (e) {
    res.status(500).json({ error: `美化失败: ${e.message}` });
  }
});

/**
 * POST /api/context
 * 获取指定位置的上下文代码（原始代码视图）
 */
router.post('/context', (req, res) => {
  try {
    const source = resolveSource(req);
    if (!source) {
      return res.status(400).json({ error: '缺少 source 或 url 参数' });
    }
    const { rawOffset, contextLines } = req.body;
    if (rawOffset === undefined || rawOffset === null) {
      return res.status(400).json({ error: '缺少 rawOffset 参数' });
    }

    const ctxSize = parseInt(contextLines, 10) || 50;
    const mappingResult = beautifySource(source);
    const result = getContext(source, rawOffset, ctxSize);
    result.isMinified = mappingResult.isMinified;
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/pretty-context
 * 获取美化后代码的上下文（基于原始 col 偏移，自动美化+映射）
 */
router.post('/pretty-context', (req, res) => {
  try {
    const source = resolveSource(req);
    if (!source) {
      return res.status(400).json({ error: '缺少 source 或 url 参数' });
    }
    const { rawOffset, contextLines } = req.body;
    if (rawOffset === undefined || rawOffset === null) {
      return res.status(400).json({ error: '缺少 rawOffset 参数' });
    }

    const ctxSize = parseInt(contextLines, 10) || 50;

    // 美化 + 映射
    const mappingResult = beautifySource(source);
    const pos = findPrettyPosition(mappingResult, rawOffset);

    // 获取美化后的上下文
    const result = getPrettyContext(mappingResult.pretty, pos.prettyLine, pos.prettyCol, ctxSize);
    result.isMinified = mappingResult.isMinified;
    result.pretty = mappingResult.pretty;
    result.mappedPosition = pos;
    result.rawOffset = rawOffset;
    result.totalLines = mappingResult.pretty.split('\n').length;
    result.nonWsMatch = mappingResult.nonWsMatch;

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/pretty-context-batch
 * 批量获取多个偏移量的映射结果（避免重复美化）
 */
router.post('/pretty-context-batch', (req, res) => {
  try {
    const source = resolveSource(req);
    const { offsets, contextLines } = req.body;

    if (!source) {
      return res.status(400).json({ error: '缺少 source 或 url 参数' });
    }
    if (!offsets || !Array.isArray(offsets)) {
      return res.status(400).json({ error: '缺少 offsets 参数' });
    }

    const ctxSize = parseInt(contextLines, 10) || 0;
    const mappingResult = beautifySource(source);
    const results = [];

    for (const rawOffset of offsets) {
      const pos = findPrettyPosition(mappingResult, rawOffset);
      let context = null;
      if (ctxSize > 0) {
        context = getPrettyContext(mappingResult.pretty, pos.prettyLine, pos.prettyCol, ctxSize);
      }
      results.push({
        rawOffset,
        mappedPosition: pos,
        context: context ? context.lines : null,
      });
    }

    res.json({
      isMinified: mappingResult.isMinified,
      totalLines: mappingResult.pretty.split('\n').length,
      nonWsMatch: mappingResult.nonWsMatch,
      results,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/cache-status
 * 查看缓存状态
 */
router.get('/cache-status', (req, res) => {
  const entries = [];
  for (const [url, data] of sourceCache.entries()) {
    entries.push({
      url: url.substring(0, 80) + '...',
      size: data.content ? data.content.length : 'N/A',
      hasPretty: !!data.pretty,
      age: Math.round((Date.now() - data.timestamp) / 1000) + 's',
    });
  }
  res.json({ entries, count: entries.length });
});

/**
 * POST /api/clear-cache
 * 清除缓存
 */
router.post('/clear-cache', (req, res) => {
  sourceCache.clear();
  res.json({ message: '缓存已清除' });
});

module.exports = router;
