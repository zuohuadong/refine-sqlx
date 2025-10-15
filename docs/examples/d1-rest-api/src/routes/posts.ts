import type { DataProvider } from '@refinedev/core';
import { errorResponse, jsonResponse } from '../utils/response';
import { parseFilters, parseSorters, parsePagination } from '../utils/query';
import type { Post, PostInsert } from '../schema';

export async function handlePostsRoute(
  request: Request,
  dataProvider: DataProvider,
  url: URL
): Promise<Response> {
  const method = request.method;
  const pathParts = url.pathname.split('/').filter(Boolean);

  // GET /api/posts - List posts
  if (method === 'GET' && pathParts.length === 2) {
    try {
      const pagination = parsePagination(url.searchParams);
      const filters = parseFilters(url.searchParams);
      const sorters = parseSorters(url.searchParams);

      const { data, total } = await dataProvider.getList<Post>({
        resource: 'posts',
        pagination,
        filters,
        sorters,
      });

      return jsonResponse({
        data,
        total,
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to fetch posts', 500);
    }
  }

  // GET /api/posts/:id - Get single post
  if (method === 'GET' && pathParts.length === 3) {
    try {
      const id = parseInt(pathParts[2]);
      if (isNaN(id)) {
        return errorResponse('Invalid post ID', 400);
      }

      const { data } = await dataProvider.getOne<Post>({
        resource: 'posts',
        id,
      });

      return jsonResponse(data);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Post not found', 404);
    }
  }

  // POST /api/posts - Create post
  if (method === 'POST' && pathParts.length === 2) {
    try {
      const body = await request.json() as PostInsert;

      // Validation
      if (!body.title || !body.content || !body.userId) {
        return errorResponse('Title, content, and userId are required', 400);
      }

      const { data } = await dataProvider.create<Post, PostInsert>({
        resource: 'posts',
        variables: {
          ...body,
          createdAt: new Date(),
        },
      });

      return jsonResponse(data, 201);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to create post', 500);
    }
  }

  // PUT /api/posts/:id - Update post
  if (method === 'PUT' && pathParts.length === 3) {
    try {
      const id = parseInt(pathParts[2]);
      if (isNaN(id)) {
        return errorResponse('Invalid post ID', 400);
      }

      const body = await request.json() as Partial<PostInsert>;

      const { data } = await dataProvider.update<Post>({
        resource: 'posts',
        id,
        variables: {
          ...body,
          updatedAt: new Date(),
        },
      });

      return jsonResponse(data);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to update post', 500);
    }
  }

  // DELETE /api/posts/:id - Delete post
  if (method === 'DELETE' && pathParts.length === 3) {
    try {
      const id = parseInt(pathParts[2]);
      if (isNaN(id)) {
        return errorResponse('Invalid post ID', 400);
      }

      await dataProvider.deleteOne({
        resource: 'posts',
        id,
      });

      return jsonResponse({ success: true, id });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to delete post', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
