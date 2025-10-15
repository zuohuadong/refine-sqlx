import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { createRefineSQL } from 'refine-sqlx/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';
import { usersRoutes } from './routes/users';
import { postsRoutes } from './routes/posts';
import { authRoutes } from './routes/auth';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', cors());
app.use('*', logger());
app.use('*', prettyJSON());

// Initialize data provider middleware
app.use('*', async (c, next) => {
  const dataProvider = createRefineSQL({
    connection: c.env.DB,
    schema,
  });
  c.set('dataProvider', dataProvider);
  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get('/', (c) => {
  return c.json({
    name: 'refine-sqlx + Hono API',
    version: '1.0.0',
    framework: 'Hono',
    runtime: 'Cloudflare Workers',
    endpoints: {
      users: '/api/users',
      posts: '/api/posts',
      auth: '/auth',
    },
    docs: '/docs',
  });
});

// Mount routes
app.route('/api/users', usersRoutes);
app.route('/api/posts', postsRoutes);
app.route('/auth', authRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    {
      error: err.message || 'Internal Server Error',
    },
    500
  );
});

export default app;
