/**
 * 源码下载服务 - 从 URL 下载 JS 文件（服务端，无 CORS 限制）
 */
const https = require('https');
const http = require('http');
const url = require('url');

/**
 * 从 URL 下载源码
 * @param {string} sourceUrl
 * @returns {Promise<{ content: string, url: string, size: number }>}
 */
function fetchSource(sourceUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(sourceUrl);
    const mod = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      path: parsed.path,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      timeout: 30000,
    };

    const req = mod.request(options, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchSource(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }

      const chunks = [];
      let totalSize = 0;

      res.on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        // 限制最大 50MB 防止内存溢出
        if (totalSize > 50 * 1024 * 1024) {
          req.destroy();
          reject(new Error('文件过大 (>50MB)'));
        }
      });

      res.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf-8');
        resolve({
          content,
          url: sourceUrl,
          size: content.length,
        });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时 (30s)'));
    });

    req.end();
  });
}

/**
 * 从堆栈帧中提取主要 URL
 * @param {Array} frames
 * @returns {string|null}
 */
function getMainSourceUrl(frames) {
  const urls = [...new Set(frames.map(f => f.url))];
  // 优先选择包含 index 或 main 的文件
  const mainUrl = urls.find(u => /index\.|main\.|bundle\.|app\./.test(u)) || urls[0];
  return mainUrl || null;
}

module.exports = { fetchSource, getMainSourceUrl };
