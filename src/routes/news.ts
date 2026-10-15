import { Hono } from 'hono';

export const newsRouter = new Hono();

export interface HotNewsItem {
  id: string;
  title: string;
  url: string;
  mobileUrl?: string;
  extra?: {
    info?: string;
    hover?: string;
    date?: string;
    icon?: string;
    diff?: number;
  };
}

export interface HotNewsSourceResult {
  id: string;
  name: string;
  items: HotNewsItem[];
  updatedTime: number;
}

// In-memory cache for news items (5 minutes TTL)
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

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

// ==========================================
// Individual Platform Scrapers
// ==========================================

// 1. Weibo
async function fetchWeibo(): Promise<HotNewsItem[]> {
  const res = await fetch('https://weibo.com/ajax/side/hotSearch', {
    headers: { ...DEFAULT_HEADERS, Referer: 'https://weibo.com/' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const realtime = json?.data?.realtime || [];
  return realtime.slice(0, 20).map((item: any, idx: number) => ({
    id: `wb-${idx + 1}`,
    title: item.word || item.note || '',
    url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`,
    extra: {
      info: item.label_name ? `${item.label_name} · ${Math.round((item.num || 0) / 10000)}万` : `${Math.round((item.num || 0) / 10000)}万热度`,
      hover: item.word || '微博实时热搜',
    },
  }));
}

// 2. Zhihu
async function fetchZhihu(): Promise<HotNewsItem[]> {
  const res = await fetch('https://api.zhihu.com/topstory/hot-lists/total?limit=15', {
    headers: { ...DEFAULT_HEADERS, Referer: 'https://www.zhihu.com/hot' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const list = json?.data || [];
  return list.slice(0, 15).map((item: any, idx: number) => ({
    id: `zh-${item.target?.id || idx + 1}`,
    title: item.target?.title || '',
    url: `https://www.zhihu.com/question/${item.target?.id}`,
    extra: {
      info: item.detail_text || '热榜讨论',
      hover: item.target?.excerpt || '知乎热榜',
    },
  }));
}

// 3. Bilibili
async function fetchBilibili(): Promise<HotNewsItem[]> {
  const res = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=15', {
    headers: { ...DEFAULT_HEADERS, Referer: 'https://www.bilibili.com/' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const list = json?.data?.list || [];
  return list.slice(0, 15).map((item: any, idx: number) => ({
    id: `bili-${item.bvid || idx + 1}`,
    title: item.title || '',
    url: `https://www.bilibili.com/video/${item.bvid}`,
    extra: {
      info: `${Math.round((item.stat?.view || 0) / 10000)}万播放`,
      hover: item.tname || item.owner?.name || '哔哩哔哩热门视频',
    },
  }));
}

// 4. Baidu
async function fetchBaidu(): Promise<HotNewsItem[]> {
  const res = await fetch('https://top.baidu.com/board?tab=realtime', {
    headers: { ...DEFAULT_HEADERS, Referer: 'https://www.baidu.com/' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const dataMatch = html.match(/<!--s-data:([\s\S]*?)-->/);
  if (!dataMatch) return [];
  try {
    const raw = JSON.parse(dataMatch[1]);
    const cards = raw?.data?.cards?.[0]?.content || [];
    return cards.slice(0, 15).map((card: any, idx: number) => ({
      id: `bd-${idx + 1}`,
      title: card.word || '',
      url: `https://www.baidu.com/s?wd=${encodeURIComponent(card.word || '')}`,
      extra: {
        info: card.hotScore ? `${Math.round(card.hotScore / 10000)}万指数` : '实时检索',
        hover: card.desc || '百度实时风向',
      },
    }));
  } catch {
    return [];
  }
}

// 5. Douyin
async function fetchDouyin(): Promise<HotNewsItem[]> {
  const res = await fetch('https://aweme.snssdk.com/aweme/v1/hot/search/list/', {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const list = json?.data?.word_list || [];
  return list.slice(0, 15).map((w: any, idx: number) => ({
    id: `dy-${idx + 1}`,
    title: w.word || '',
    url: `https://www.douyin.com/search/${encodeURIComponent(w.word || '')}`,
    extra: {
      info: w.hot_value ? `${Math.round(w.hot_value / 10000)}万在看` : '抖音热点',
      hover: w.word || '短视频潮流',
    },
  }));
}

// 6. Toutiao
async function fetchToutiao(): Promise<HotNewsItem[]> {
  const res = await fetch('https://i.snssdk.com/api/suggest_words/?business_id=10016', {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const list = json?.data?.[0]?.words || [];
  return list.slice(0, 15).map((w: any, idx: number) => ({
    id: `tt-${idx + 1}`,
    title: w.word || '',
    url: `https://www.toutiao.com/search/?keyword=${encodeURIComponent(w.word || '')}`,
    extra: {
      info: '今日热点',
      hover: w.word || '综合大事件',
    },
  }));
}

// 7. SSPAI (少数派)
async function fetchSSPAI(): Promise<HotNewsItem[]> {
  const res = await fetch(
    'https://sspai.com/api/v1/article/tag/page/get?limit=15&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0',
    { headers: DEFAULT_HEADERS, signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const list = json?.data || [];
  return list.slice(0, 12).map((item: any, idx: number) => ({
    id: `ss-${item.id || idx + 1}`,
    title: item.title || '',
    url: `https://sspai.com/post/${item.id}`,
    extra: {
      info: `${item.like_count || 0} 赞`,
      hover: item.summary || '数字高效生活',
    },
  }));
}

// 8. Juejin (稀土掘金)
async function fetchJuejin(): Promise<HotNewsItem[]> {
  const res = await fetch('https://api.juejin.cn/content_api/v1/content/article_rank?category_id=1&type=hot', {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const list = json?.data || [];
  return list.slice(0, 12).map((item: any, idx: number) => ({
    id: `jj-${item.content?.content_id || idx + 1}`,
    title: item.content?.title || '',
    url: `https://juejin.cn/post/${item.content?.content_id}`,
    extra: {
      info: `${Math.round((item.content_counter?.view_count || 0) / 1000) / 10}k 浏览`,
      hover: '开发者前沿实践',
    },
  }));
}

// 9. IT Home (IT 之家)
async function fetchITHome(): Promise<HotNewsItem[]> {
  const res = await fetch('https://api.ithome.com/json/newslist/news', {
    headers: { ...DEFAULT_HEADERS, 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const list = json?.newslist || [];
  return list.slice(0, 12).map((item: any, idx: number) => ({
    id: `it-${item.newsid || idx + 1}`,
    title: item.title || '',
    url: item.url || `https://www.ithome.com/html/it/${item.newsid}.htm`,
    extra: {
      info: item.postdate ? item.postdate.slice(11, 16) : '数码资讯',
      hover: 'IT之家一手科技',
    },
  }));
}

// 10. Hacker News
async function fetchHackerNews(): Promise<HotNewsItem[]> {
  const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=15', {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const hits = json?.hits || [];
  return hits.slice(0, 12).map((h: any) => ({
    id: `hn-${h.objectID}`,
    title: h.title || '',
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    extra: {
      info: `${h.points || 0} pts · ${h.num_comments || 0} com`,
      hover: '极客硅谷热榜',
    },
  }));
}

// 11. V2EX
async function fetchV2EX(): Promise<HotNewsItem[]> {
  try {
    const res = await fetch('https://www.v2ex.com/api/topics/hot.json', {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const list = (await res.json()) as any;
    if (!Array.isArray(list)) return [];
    return list.slice(0, 12).map((t: any) => ({
      id: `v2-${t.id}`,
      title: t.title || '',
      url: t.url || `https://v2ex.com/t/${t.id}`,
      extra: {
        info: `${t.replies || 0} 回复`,
        hover: t.node?.title || '程序员交流社区',
      },
    }));
  } catch {
    return [];
  }
}

// 12. GitHub Trending
async function fetchGitHub(): Promise<HotNewsItem[]> {
  try {
    const res = await fetch('https://github.com/trending', {
      headers: { ...DEFAULT_HEADERS, Accept: 'text/html' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const articles = html.split('<article class="Box-row">').slice(1);
    const items: HotNewsItem[] = [];

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

      const starInfo = starsToday ? `⭐ 今日+${starsToday}` : '热门开源';
      items.push({
        id: `gh-${repo.replace('/', '-')}`,
        title: `${repo}${description ? ` - ${description}` : ''}`,
        url: `https://github.com/${repo}`,
        extra: {
          info: starInfo,
          hover: [language, description].filter(Boolean).join(' · ') || 'GitHub Trending',
        },
      });
    }
    return items;
  } catch {
    return [];
  }
}

// 13. Wallstreetcn (华尔街见闻)
async function fetchWallstreetcn(): Promise<HotNewsItem[]> {
  try {
    const res = await fetch('https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&limit=15', {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const items = json?.data?.items || [];
    return items.slice(0, 12).map((item: any, idx: number) => ({
      id: `wscn-${item.id || idx + 1}`,
      title: item.title || item.content_text?.slice(0, 60) || '全球财经要闻',
      url: 'https://wallstreetcn.com/live/global',
      extra: {
        info: '全球市场',
        hover: '华尔街见闻实时雷达',
      },
    }));
  } catch {
    return [];
  }
}

// Dispatcher registry
const PLATFORM_FETCHERS: Record<string, () => Promise<HotNewsItem[]>> = {
  weibo: fetchWeibo,
  zhihu: fetchZhihu,
  bilibili: fetchBilibili,
  baidu: fetchBaidu,
  douyin: fetchDouyin,
  toutiao: fetchToutiao,
  sspai: fetchSSPAI,
  juejin: fetchJuejin,
  ithome: fetchITHome,
  hackernews: fetchHackerNews,
  v2ex: fetchV2EX,
  github: fetchGitHub,
  'wallstreetcn-hot': fetchWallstreetcn,
  'cls-hot': fetchWallstreetcn, // Fallback/share finance channel
  'xueqiu-hotstock': fetchWallstreetcn,
};

async function getSourceData(sourceId: string): Promise<HotNewsItem[]> {
  const cached = getCached<HotNewsItem[]>(sourceId);
  if (cached) return cached;

  const fetcher = PLATFORM_FETCHERS[sourceId];
  if (!fetcher) return [];

  try {
    const items = await fetcher();
    if (items && items.length > 0) {
      setCache(sourceId, items);
      return items;
    }
  } catch (err) {
    console.warn(`[Fetcher Error] ${sourceId}:`, err);
  }
  return [];
}

// ==========================================
// Routes
// ==========================================

// 1. Available sources directory
newsRouter.get('/sources', (c) => {
  return c.json({
    status: 'ok',
    total: Object.keys(PLATFORM_FETCHERS).length + 1,
    sources: [
      { id: '60s', name: '每日60秒早报', endpoint: '/api/news/60s' },
      ...Object.keys(PLATFORM_FETCHERS).map((k) => ({
        id: k,
        name: k.toUpperCase(),
        endpoint: `/api/news/${k}`,
      })),
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
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        if (json?.data) {
          setCache('60s', json.data);
          return c.json({ status: 'ok', cached: false, data: json.data });
        }
      }
    } catch {}
  }

  return c.json({ status: 'error', message: 'Failed to fetch 60s news' }, 502);
});

// 3. Multi-source Aggregator (supports both POST & GET)
// Compatible with both /api/s/entire and /api/news/entire / /api/news/hot
const handleEntireAggregator = async (c: any) => {
  let requestedSources: string[] = Object.keys(PLATFORM_FETCHERS);

  // Parse requested sources if sent via POST
  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json();
      if (Array.isArray(body?.sources) && body.sources.length > 0) {
        requestedSources = body.sources;
      }
    } catch {}
  }

  // Fetch all requested platforms concurrently
  const results = await Promise.all(
    requestedSources.map(async (sourceId) => {
      const items = await getSourceData(sourceId);
      return {
        id: sourceId,
        items,
        updatedTime: Date.now(),
      };
    })
  );

  // Return filtered non-empty sources
  return c.json(results);
};

newsRouter.get('/entire', handleEntireAggregator);
newsRouter.post('/entire', handleEntireAggregator);
newsRouter.get('/hot', handleEntireAggregator);
newsRouter.post('/hot', handleEntireAggregator);

// 4. Single Platform Endpoint: /api/news/:id
newsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (id === '60s') return c.redirect('/api/news/60s');

  const items = await getSourceData(id);
  if (items.length > 0) {
    return c.json({
      status: 'ok',
      id,
      count: items.length,
      items,
      updatedTime: Date.now(),
    });
  }

  return c.json({ status: 'error', message: `No data found for source: ${id}` }, 404);
});
