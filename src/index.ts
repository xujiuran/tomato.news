import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { healthRouter } from './routes/health.js';
import { apiRouter } from './routes/api.js';
import { newsRouter } from './routes/news.js';

// Load environment variables natively (Node.js 20+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // .env is optional; environment variables can be passed directly via Docker / shell
  }
}

const app = new Hono();

// Global Middlewares
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Welcome Root Route
app.get('/', (c) => {
  return c.json({
    message: '🚀 TomatoX News Server (tomato.news) is running smoothly!',
    platform: process.platform,
    arch: process.arch,
    documentation: '/api/info',
    health: '/health',
  });
});

// Mount modular sub-routers
app.route('/health', healthRouter);
app.route('/api', apiRouter);
app.route('/api/news', newsRouter);

// 404 Handler
app.notFound((c) => {
  return c.json(
    {
      status: 'error',
      code: 404,
      message: `Route not found: [${c.req.method}] ${c.req.path}`,
      availableRoutes: ['/', '/health', '/api/info', '/api/news/sources'],
    },
    404
  );
});

// 500 Error Handler
app.onError((err, c) => {
  console.error(`[Unhandled Error] ${c.req.method} ${c.req.url}:`, err);
  return c.json(
    {
      status: 'error',
      code: 500,
      message: err.message || 'Internal Server Error',
    },
    500
  );
});

// Server Configuration
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

console.log(`-----------------------------------------------`);
console.log(`  TomatoX News Server (tomato.news) Starting...`);
console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`  Arch:        ${process.arch}                 `);
console.log(`  Host:        ${host}:${port}                 `);
console.log(`-----------------------------------------------`);

const server = serve({
  fetch: app.fetch,
  port,
  hostname: host,
});

// Graceful Shutdown for Docker
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Gracefully stopping server...`);
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    console.log('Server stopped successfully. Goodbye!');
    process.exit(0);
  });

  // Force exit after 5 seconds if still hung
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
