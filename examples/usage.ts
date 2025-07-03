// Example usage of refine-sqlite as a dataProvider for Refine framework
// npm install refine-sqlite @refinedev/core

import { dataProvider } from '../src';
import type { D1Database } from '../src';

// Example 1: Cloudflare Worker with Refine + D1
export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const provider = dataProvider(env.DB);
    
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      
      // Handle Refine dataProvider API calls
      if (path.startsWith('/api/refine/')) {
        const resource = url.searchParams.get('resource');
        const id = url.searchParams.get('id');
        
        if (!resource) {
          return new Response(JSON.stringify({ error: 'Resource is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        switch (method) {
          case 'GET':
            if (id) {
              // getOne
              const result = await provider.getOne({ resource, id });
              return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
              });
            } else {
              // getList with pagination and filters from URL params
              const current = parseInt(url.searchParams.get('current') || '1');
              const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
              
              const result = await provider.getList({
                resource,
                pagination: { current, pageSize }
              });
              return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
          case 'POST':
            // create
            const createData = await request.json();
            const created = await provider.create({
              resource,
              variables: createData
            });
            return new Response(JSON.stringify(created), {
              status: 201,
              headers: { 'Content-Type': 'application/json' }
            });
            
          case 'PUT':
            // update
            if (!id) {
              return new Response(JSON.stringify({ error: 'ID is required for update' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            const updateData = await request.json();
            const updated = await provider.update({
              resource,
              id,
              variables: updateData
            });
            return new Response(JSON.stringify(updated), {
              headers: { 'Content-Type': 'application/json' }
            });
            
          case 'DELETE':
            // deleteOne
            if (!id) {
              return new Response(JSON.stringify({ error: 'ID is required for delete' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            const deleted = await provider.deleteOne({ resource, id });
            return new Response(JSON.stringify(deleted), {
              headers: { 'Content-Type': 'application/json' }
            });
            
          default:
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { 'Content-Type': 'application/json' }
            });
        }
      }
      
      // API documentation
      return new Response(JSON.stringify({
        message: 'Refine SQLite + D1 DataProvider API',
        version: '2.0.0',
        endpoints: {
          'GET /api/refine/?resource=posts': 'List posts (supports current, pageSize params)',
          'GET /api/refine/?resource=posts&id=1': 'Get specific post',
          'POST /api/refine/?resource=posts': 'Create new post',
          'PUT /api/refine/?resource=posts&id=1': 'Update specific post',
          'DELETE /api/refine/?resource=posts&id=1': 'Delete specific post'
        },
        usage: 'This API is designed to work with Refine framework dataProvider'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Example 2: Direct usage (testing/standalone)
async function testDataProvider() {
  console.log('=== Testing DataProvider ===');
  
  const provider = dataProvider('./test/test.db');
  
  try {
    // This is how Refine internally calls the dataProvider
    const posts = await provider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      sorters: [{ field: 'id', order: 'desc' }],
      filters: [{ field: 'published', operator: 'eq', value: [true] }]
    });
    
    console.log('Posts from dataProvider:', posts);
    
  } catch (error) {
    console.error('DataProvider test error:', error);
  }
}

// Run test if in Node.js environment
if (typeof process !== 'undefined' && process.versions?.node) {
  testDataProvider();
}
