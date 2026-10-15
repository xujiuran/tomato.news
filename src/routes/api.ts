import { Hono } from 'hono';

export const apiRouter = new Hono();

apiRouter.get('/info', (c) => {
  return c.json({
    name: 'TomatoX News Server (tomato.news)',
    version: '1.0.0',
    description: 'High-performance microservice ready for Docker ARM64',
    endpoints: [
      { path: '/', method: 'GET', desc: 'Welcome landing' },
      { path: '/health', method: 'GET', desc: 'Server health check & system architecture' },
      { path: '/api/info', method: 'GET', desc: 'Server info & endpoint discovery' },
      { path: '/api/time', method: 'GET', desc: 'Current server time in Shanghai and UTC' },
      { path: '/api/echo', method: 'POST', desc: 'Echo payload test' },
      { path: '/api/news/sources', method: 'GET', desc: 'List news sources' },
      { path: '/api/news/60s', method: 'GET', desc: 'Daily 60s summary' },
      { path: '/api/news/weibo', method: 'GET', desc: 'Weibo real-time hot search' },
      { path: '/api/news/github', method: 'GET', desc: 'GitHub trending repositories' },
    ],
  });
});

apiRouter.get('/time', (c) => {
  const now = new Date();
  const shanghai = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now);

  return c.json({
    utc: now.toISOString(),
    timestamp: now.getTime(),
    shanghai,
  });
});

apiRouter.post('/echo', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({
      received: body,
      headers: {
        host: c.req.header('host'),
        'user-agent': c.req.header('user-agent'),
      },
    });
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
});
