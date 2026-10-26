import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';

export const viewsRouter = new Hono();

// Base seed counts for existing posts to give realistic visitor metrics
const DEFAULT_SEEDS: Record<string, number> = {
  'minimal-web-engineering': 486,
  'ai-knowledge-workflow': 362,
  'crafting-tiny-tools': 295,
  'modern-css-evolution': 328,
  'deep-work-system': 441,
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const VIEWS_FILE = path.join(DATA_DIR, 'views.json');

// In-memory cache
let viewsCache: Record<string, number> = { ...DEFAULT_SEEDS };
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
      viewsCache = { ...DEFAULT_SEEDS, ...parsed };
    } else {
      saveViewsToDiskImmediately();
    }
  } catch (err) {
    console.error('[Views] Failed to load views from disk, using defaults:', err);
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

  const views = viewsCache[slug] ?? (DEFAULT_SEEDS[slug] || 120);
  return c.json({
    code: 200,
    status: 'success',
    data: {
      slug,
      views,
    },
  });
});

// 3. POST /api/views/:slug - Increment view count for article
viewsRouter.post('/:slug', (c) => {
  const slug = c.req.param('slug');
  if (!slug) {
    return c.json({ code: 400, message: 'Missing slug parameter' }, 400);
  }

  const current = viewsCache[slug] ?? (DEFAULT_SEEDS[slug] || 120);
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
