import { dataProvider } from './provider';
import { D1Database } from './types';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Initialize data provider with D1 database
      const provider = dataProvider(env.DB);

      // Parse request body if present
      let body = null;
      if (request.method === 'POST' || request.method === 'PUT') {
        body = await request.json();
      }

      let result;

      // Route handling
      if (path.startsWith('/api/')) {
        const segments = path.split('/').filter(Boolean);
        const resource = segments[1]; // /api/posts -> 'posts'
        const id = segments[2]; // /api/posts/123 -> '123'

        switch (request.method) {
          case 'GET':
            if (id) {
              // Get single record
              result = await provider.getOne({ resource, id });
            } else {
              // Get list with query parameters
              const searchParams = url.searchParams;
              const pagination = {
                current: parseInt(searchParams.get('current') || '1'),
                pageSize: parseInt(searchParams.get('pageSize') || '10'),
              };
              
              result = await provider.getList({
                resource,
                pagination,
                filters: [],
                sorters: [],
              });
            }
            break;

          case 'POST':
            // Create new record
            result = await provider.create({
              resource,
              variables: body as Record<string, any>,
            });
            break;

          case 'PUT':
            // Update existing record
            if (!id) {
              throw new Error('ID is required for update operations');
            }
            result = await provider.update({
              resource,
              id,
              variables: body as Record<string, any>,
            });
            break;

          case 'DELETE':
            // Delete record
            if (!id) {
              throw new Error('ID is required for delete operations');
            }
            result = await provider.deleteOne({
              resource,
              id,
            });
            break;

          default:
            throw new Error(`Method ${request.method} not supported`);
        }
      } else {
        // Default response
        result = {
          message: 'Refine SQLite Data Provider - Cloudflare Workers Edition',
          endpoints: {
            'GET /api/{resource}': 'Get list of records',
            'GET /api/{resource}/{id}': 'Get single record',
            'POST /api/{resource}': 'Create new record',
            'PUT /api/{resource}/{id}': 'Update existing record',
            'DELETE /api/{resource}/{id}': 'Delete record',
          },
        };
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};
