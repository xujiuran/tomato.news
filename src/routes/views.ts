import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';

export const viewsRouter = new Hono();

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const VIEWS_FILE = path.join(DATA_DIR, 'views.json');

// In-memory cache for real visitor view counts
let viewsCache: Record<string, number> = {};
let isDirty = false;
let saveTimer: NodeJS.Timeout | null = null;

// Initialize data persistence from disk
function loadViewsFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(VIEWS_FILE)) {
      const raw = fs.readFileSync(VIEWS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        viewsCache = parsed;
      }
    } else {
      saveViewsToDiskImmediately();
    }
  } catch (err) {
    console.error('[Views] Failed to load views from disk:', err);
  }
}

function saveViewsToDiskImmediately() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(VIEWS_FILE, JSON.stringify(viewsCache, null, 2), 'utf-8');
    isDirty = false;
  } catch (err) {
    console.error('[Views] Failed to save views to disk:', err);
  }
}

function scheduleSave() {
  isDirty = true;
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (isDirty) {
        saveViewsToDiskImmediately();
      }
    }, 1500);
  }
}

// Load on startup
loadViewsFromDisk();

// 1. GET /api/views - Batch retrieve all article view counts
viewsRouter.get('/', (c) => {
  return c.json({
    code: 200,
    status: 'success',
    data: viewsCache,
    updatedAt: new Date().toISOString(),
  });
});

// 2. GET /api/views/:slug - Get single article view count
viewsRouter.get('/:slug', (c) => {
  const slug = c.req.param('slug');
  if (!slug) {
    return c.json({ code: 400, message: 'Missing slug parameter' }, 400);
  }

  const views = viewsCache[slug] || 0;
  return c.json({
    code: 200,
    status: 'success',
    data: {
      slug,
      views,
    },
  });
});

// 3. POST /api/views/:slug - Increment real view count for article
viewsRouter.post('/:slug', (c) => {
  const slug = c.req.param('slug');
  if (!slug) {
    return c.json({ code: 400, message: 'Missing slug parameter' }, 400);
  }

  const current = viewsCache[slug] || 0;
  const next = current + 1;
  viewsCache[slug] = next;
  scheduleSave();

  return c.json({
    code: 200,
    status: 'success',
    data: {
      slug,
      views: next,
    },
  });
});
