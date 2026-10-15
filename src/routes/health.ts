import { Hono } from 'hono';

export const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  const memory = process.memoryUsage();

  return c.json({
    status: 'ok',
    service: 'tomato.news',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    system: {
      arch: process.arch, // Will display 'arm64' on ARM64 VPS
      platform: process.platform, // 'linux' on VPS
      nodeVersion: process.version,
      pid: process.pid,
      memory: {
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      },
    },
    docker: {
      isContainer: Boolean(process.env.DOCKER_CONTAINER || process.env.IS_DOCKER),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  });
});
