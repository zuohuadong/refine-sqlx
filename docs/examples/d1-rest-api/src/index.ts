import { createRefineSQL } from 'refine-sqlx/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';
import { handleUsersRoute } from './routes/users';
import { handlePostsRoute } from './routes/posts';
import { errorResponse, jsonResponse } from './utils/response';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Initialize data provider
      const dataProvider = createRefineSQL({
        connection: env.DB,
        schema,
      });

      // Health check
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      // API routes
      if (path.startsWith('/api/users')) {
        return handleUsersRoute(request, dataProvider, url);
      }

      if (path.startsWith('/api/posts')) {
        return handlePostsRoute(request, dataProvider, url);
      }

      // Root endpoint - API documentation
      if (path === '/' || path === '/api') {
        return jsonResponse({
          name: 'refine-sqlx D1 REST API',
          version: '1.0.0',
          endpoints: {
            users: {
              list: 'GET /api/users',
              get: 'GET /api/users/:id',
              create: 'POST /api/users',
              update: 'PUT /api/users/:id',
              delete: 'DELETE /api/users/:id',
              batch: 'POST /api/users/batch',
            },
            posts: {
              list: 'GET /api/posts',
              get: 'GET /api/posts/:id',
              create: 'POST /api/posts',
              update: 'PUT /api/posts/:id',
              delete: 'DELETE /api/posts/:id',
            },
          },
          docs: 'https://github.com/medz/refine-sqlx',
        });
      }

      return errorResponse('Not Found', 404);
    } catch (error) {
      console.error('Request error:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Internal Server Error',
        500
      );
    }
  },
};
