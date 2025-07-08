// Example: Cloudflare Worker with D1
import { dataProvider } from 'refine-d1';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Initialize provider with D1 database
      const provider = dataProvider(env.DB);
      
      // Example: Get all users
      const users = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });
      
      return Response.json({
        success: true,
        data: users.data,
        total: users.total,
        runtime: 'cloudflare-d1'
      });
      
    } catch (error) {
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
};
