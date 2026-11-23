import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALL_SOURCES, SOURCE_MAP } from './server/sources/index.ts';
import type { DiscoveredSlideItem, SourceSearchOutput } from './server/sources/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DIST_PATH = path.resolve(__dirname, 'dist');
const IS_TSX_RUNTIME = process.execArgv.some((arg) => arg.includes('tsx'));
const IS_PROD =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' &&
    !IS_TSX_RUNTIME &&
    fs.existsSync(path.join(DIST_PATH, 'index.html')));

// Simple in-memory TTL cache for discovery queries (5 minutes)
interface CacheEntry {
  expiresAt: number;
  payload: unknown;
}
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  if (net.isIPv4(lower)) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }

  if (net.isIPv6(lower)) {
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }

  return false;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', sources: ALL_SOURCES.length });
  });

  app.get('/api/sources', (_req, res) => {
    res.json({
      sources: ALL_SOURCES.map((s) => s.descriptor),
    });
  });

  app.get('/api/discover', async (req, res) => {
    const query = String(req.query.q ?? '').trim();
    const system = String(req.query.system ?? 'all').trim();
    const stain = String(req.query.stain ?? 'all').trim();
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(40, Math.max(4, Number(req.query.limit ?? 12) || 12));
    const sourcesParam = String(req.query.sources ?? '').trim();

    if (!query) {
      res.status(400).json({ error: 'Search query "q" is required.' });
      return;
    }

    const requestedIds = sourcesParam
      ? sourcesParam
          .split(',')
          .map((s) => s.trim())
          .filter((id) => SOURCE_MAP.has(id))
      : ALL_SOURCES.map((s) => s.descriptor.id);

    if (requestedIds.length === 0) {
      res.status(400).json({ error: 'No valid source IDs specified.' });
      return;
    }

    const cacheKey = JSON.stringify({ query, system, stain, page, limit, requestedIds });
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    const activeConnectors = requestedIds
      .map((id) => SOURCE_MAP.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const outputs: SourceSearchOutput[] = await Promise.all(
      activeConnectors.map((connector) =>
        connector.search({
          query,
          system,
          stain,
          page,
          limit,
        })
      )
    );

    // Interleave open-access direct-import slides first, then university external references
    const openAccessItems: DiscoveredSlideItem[] = [];
    const universityItems: DiscoveredSlideItem[] = [];
    const sourceStatuses: Array<{
      sourceId: string;
      count: number;
      hasMore: boolean;
      error?: string;
    }> = [];

    for (const out of outputs) {
      sourceStatuses.push({
        sourceId: out.sourceId,
        count: out.items.length,
        hasMore: out.hasMore,
        error: out.error,
      });

      for (const item of out.items) {
        if (item.directImportAllowed) {
          openAccessItems.push(item);
        } else {
          universityItems.push(item);
        }
      }
    }

    const results = [...openAccessItems, ...universityItems];
    const hasMore = outputs.some((o) => o.hasMore);

    const payload = {
      query,
      page,
      hasMore,
      results,
      sourceStatuses,
    };

    searchCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    // Keep cache bounded
    if (searchCache.size > 100) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey) searchCache.delete(oldestKey);
    }

    res.json(payload);
  });

  // Secure image caching endpoint for open-access imported slides (used when user caches offline)
  app.get('/api/image-proxy', async (req, res) => {
    const rawUrl = String(req.query.url ?? '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing image URL.' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid URL format.' });
      return;
    }

    if (parsed.protocol !== 'https:') {
      res.status(400).json({ error: 'Only HTTPS image URLs are permitted.' });
      return;
    }

    if (isPrivateOrBlockedHost(parsed.hostname)) {
      res.status(403).json({ error: 'Access to private or local hosts is forbidden.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          'User-Agent': 'HistoAtlas/2.0 (Educational Histology Study Studio)',
        },
        signal: controller.signal,
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream returned HTTP ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        res.status(415).json({ error: 'Upstream resource is not an image.' });
        return;
      }

      const arrayBuffer = await upstream.arrayBuffer();
      if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
        res.status(413).json({ error: 'Image exceeds 20 MB offline cache limit.' });
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch image';
      res.status(502).json({ error: msg });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Batch image health & MIME verifier for Slide Quality Audit
  app.post('/api/audit-image', async (req, res) => {
    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'Request body must include a non-empty "items" array.' });
      return;
    }

    const items = rawItems
      .slice(0, 30)
      .map((item) => ({
        id: String(item?.id ?? ''),
        url: String(item?.url ?? '').trim(),
      }))
      .filter((item) => item.id && item.url);

    if (items.length === 0) {
      res.status(400).json({ error: 'No valid audit items provided.' });
      return;
    }

    interface AuditItemResult {
      id: string;
      ok: boolean;
      status: number;
      contentType: string;
      contentLength?: number;
      error?: string;
    }

    const probeOne = async (item: { id: string; url: string }): Promise<AuditItemResult> => {
      let parsed: URL;
      try {
        parsed = new URL(item.url);
      } catch {
        return {
          id: item.id,
          ok: false,
          status: 400,
          contentType: '',
          error: 'Invalid URL format.',
        };
      }

      if (parsed.protocol !== 'https:') {
        return {
          id: item.id,
          ok: false,
          status: 400,
          contentType: '',
          error: 'Only HTTPS image URLs are permitted.',
        };
      }

      if (isPrivateOrBlockedHost(parsed.hostname)) {
        return {
          id: item.id,
          ok: false,
          status: 403,
          contentType: '',
          error: 'Access to private or local hosts is forbidden.',
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        let upstream = await fetch(parsed.toString(), {
          method: 'HEAD',
          headers: {
            'User-Agent': 'HistoAtlas/2.0 (Educational Histology Study Studio)',
          },
          signal: controller.signal,
        });

        if (
          upstream.status === 400 ||
          upstream.status === 403 ||
          upstream.status === 405 ||
          upstream.status === 501
        ) {
          upstream = await fetch(parsed.toString(), {
            method: 'GET',
            headers: {
              'User-Agent': 'HistoAtlas/2.0 (Educational Histology Study Studio)',
              Range: 'bytes=0-1024',
            },
            signal: controller.signal,
          });
        }

        await upstream.body?.cancel().catch(() => {});

        const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const rawLength = upstream.headers.get('content-length');
        const parsedLength = rawLength ? Number(rawLength) : undefined;
        const contentLength =
          parsedLength !== undefined && Number.isFinite(parsedLength) ? parsedLength : undefined;

        return {
          id: item.id,
          ok: upstream.ok,
          status: upstream.status,
          contentType,
          contentLength,
          error: upstream.ok ? undefined : `HTTP ${upstream.status}`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        return {
          id: item.id,
          ok: false,
          status: 0,
          contentType: '',
          error: msg,
        };
      } finally {
        clearTimeout(timeout);
      }
    };

    const results: AuditItemResult[] = new Array(items.length);
    let cursor = 0;
    const workerCount = Math.min(6, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (cursor < items.length) {
          const idx = cursor++;
          results[idx] = await probeOne(items[idx]);
        }
      })
    );

    res.json({ results });
  });

  const httpServer = http.createServer(app);

  if (!IS_PROD) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';

    // When HMR is disabled in middlewareMode, Vite 8 still serves /@vite/client with
    // hmrPort = 24678 and throws "WebSocket closed without opened." in client browsers.
    // Serve a compliant no-WebSocket @vite/client module providing CSS style injection
    // and no-op HMR context APIs instead.
    if (isHmrDisabled) {
      const noHmrViteClientModule = `
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}

let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = undefined;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document
      .querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]')
      .forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}

export function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}

export class ErrorOverlay extends HTMLElement {}
`;

      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(noHmrViteClientModule);
      });
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
        ws: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(DIST_PATH)) {
      app.use(
        express.static(DIST_PATH, {
          setHeaders(res, filePath) {
            if (
              filePath.endsWith(`${path.sep}sw.js`) ||
              filePath.endsWith(`${path.sep}manifest.webmanifest`) ||
              filePath.endsWith(`${path.sep}index.html`)
            ) {
              res.setHeader('Cache-Control', 'no-cache');
            } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
          },
        })
      );
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          res.status(404).json({ error: 'API route not found.' });
          return;
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(DIST_PATH, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HistoAtlas server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start HistoAtlas server:', err);
  process.exit(1);
});
