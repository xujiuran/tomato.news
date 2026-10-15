import { Hono } from 'hono';

export const newsRouter = new Hono();

// In-memory cache for news items (5 min TTL)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL_MS) {
    return item.data as T;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

// 1. Available sources
newsRouter.get('/sources', (c) => {
  return c.json({
    status: 'ok',
    sources: [
      { id: '60s', name: '每日60秒早报', endpoint: '/api/news/60s' },
      { id: 'weibo', name: '微博实时热搜', endpoint: '/api/news/weibo' },
      { id: 'github', name: 'GitHub Trending', endpoint: '/api/news/github' },
    ],
  });
});

// 2. Daily 60s News
newsRouter.get('/60s', async (c) => {
  const cached = getCached('60s');
  if (cached) return c.json({ status: 'ok', cached: true, data: cached });

  const mirrors = [
    'https://60s.viki.moe/v2/60s',
    'https://60s-api.viki.moe/v2/60s',
    'https://60s.mizhoubaobei.top/v2/60s',
  ];

  for (const url of mirrors) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HonoServer/1.0)' },
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        if (json?.data) {
          setCache('60s', json.data);
          return c.json({ status: 'ok', cached: false, data: json.data });
        }
      }
    } catch {
      // try next mirror
    }
  }

  return c.json({ status: 'error', message: 'Failed to fetch 60s news from upstream mirrors' }, 502);
});

// 3. Weibo Hot Search (direct fetch from Weibo Open API)
newsRouter.get('/weibo', async (c) => {
  const cached = getCached('weibo');
  if (cached) return c.json({ status: 'ok', cached: true, data: cached });

  try {
    const res = await fetch('https://weibo.com/ajax/side/hotSearch', {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://weibo.com/',
      },
    });

    if (res.ok) {
      const json = (await res.json()) as any;
      const realtime = json?.data?.realtime || [];
      const items = realtime.slice(0, 20).map((item: any, idx: number) => ({
        rank: idx + 1,
        title: item.word || item.note || '',
        raw_hot: item.num || item.raw_hot,
        label: item.label_name || item.icon_desc || '',
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`,
      }));

      setCache('weibo', items);
      return c.json({ status: 'ok', cached: false, count: items.length, items });
    }
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message || 'Weibo fetch failed' }, 502);
  }

  return c.json({ status: 'error', message: 'Unable to load Weibo hot search' }, 502);
});

// 4. GitHub Trending Scraper
newsRouter.get('/github', async (c) => {
  const cached = getCached('github');
  if (cached) return c.json({ status: 'ok', cached: true, data: cached });

  try {
    const res = await fetch('https://github.com/trending', {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const articles = html.split('<article class="Box-row">').slice(1);
      const items = [];

      for (let i = 0; i < articles.length && items.length < 15; i++) {
        const art = articles[i];
        const h2Match = art.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="\/([^"]+)"[\s\S]*?<\/h2>/);
        if (!h2Match) continue;
        const repo = h2Match[1].trim();

        const pMatch = art.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
        const description = pMatch ? pMatch[1].replace(/<[^>]+>/g, '').trim().replace(/&amp;/g, '&') : '';

        const langMatch = art.match(/itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/);
        const language = langMatch ? langMatch[1].trim() : '';

        const starMatch = art.match(/([0-9,]+)\s+stars\s+today/i);
        const starsToday = starMatch ? starMatch[1] : '';

        items.push({
          repo,
          url: `https://github.com/${repo}`,
          description,
          language,
          starsToday,
        });
      }

      setCache('github', items);
      return c.json({ status: 'ok', cached: false, count: items.length, items });
    }
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message || 'GitHub Trending fetch failed' }, 502);
  }

  return c.json({ status: 'error', message: 'Unable to load GitHub Trending' }, 502);
});
