// Example usage of refine-sqlite with both SQLite and Cloudflare D1

import { dataProvider, D1Database } from '../src';

// Example 1: Using with local SQLite (Node.js)
async function exampleWithSQLite() {
  console.log('=== SQLite Example ===');
  
  const provider = dataProvider('./test.db');
  
  try {
    // Get all posts
    const posts = await provider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 }
    });
    console.log('Posts:', posts);

    // Create a new post
    const newPost = await provider.create({
      resource: 'posts',
      variables: {
        title: 'New Post from Example',
        content: 'This is a test post created via the data provider',
        category_id: 1,
        published: true
      }
    });
    console.log('Created post:', newPost);

    // Update the post
    if (newPost.data.id) {
      const updatedPost = await provider.update({
        resource: 'posts',
        id: newPost.data.id,
        variables: {
          title: 'Updated Post Title',
          content: 'This post has been updated'
        }
      });
      console.log('Updated post:', updatedPost);

      // Get single post
      const singlePost = await provider.getOne({
        resource: 'posts',
        id: newPost.data.id
      });
      console.log('Single post:', singlePost);

      // Delete the post
      await provider.deleteOne({
        resource: 'posts',
        id: newPost.data.id
      });
      console.log('Post deleted');
    }

  } catch (error) {
    console.error('SQLite Example Error:', error);
  }
}

// Example 2: Cloudflare Worker handler
export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    console.log('=== Cloudflare D1 Example ===');
    
    const provider = dataProvider(env.DB);
    
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      
      if (path === '/api/posts') {
        const posts = await provider.getList({
          resource: 'posts',
          pagination: { current: 1, pageSize: 5 }
        });
        
        return new Response(JSON.stringify(posts), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (path === '/api/test') {
        // Test all operations
        const results = {
          list: await provider.getList({ resource: 'posts' }),
          categories: await provider.getList({ resource: 'categories' })
        };
        
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        message: 'Refine SQLite + D1 Data Provider',
        endpoints: ['/api/posts', '/api/test']
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

// Run SQLite example if in Node.js environment
if (typeof process !== 'undefined' && process.versions?.node) {
  exampleWithSQLite();
}
