import type { DataProvider } from '@refinedev/core';
import { errorResponse, jsonResponse } from '../utils/response';
import { parseFilters, parseSorters, parsePagination } from '../utils/query';
import type { User, UserInsert } from '../schema';
import { batchInsert } from 'refine-sqlx/d1';

export async function handleUsersRoute(
  request: Request,
  dataProvider: DataProvider,
  url: URL
): Promise<Response> {
  const method = request.method;
  const pathParts = url.pathname.split('/').filter(Boolean);

  // GET /api/users - List users
  if (method === 'GET' && pathParts.length === 2) {
    try {
      const pagination = parsePagination(url.searchParams);
      const filters = parseFilters(url.searchParams);
      const sorters = parseSorters(url.searchParams);

      const { data, total } = await dataProvider.getList<User>({
        resource: 'users',
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
      return errorResponse(error instanceof Error ? error.message : 'Failed to fetch users', 500);
    }
  }

  // GET /api/users/:id - Get single user
  if (method === 'GET' && pathParts.length === 3) {
    try {
      const id = parseInt(pathParts[2]);
      if (isNaN(id)) {
        return errorResponse('Invalid user ID', 400);
      }

      const { data } = await dataProvider.getOne<User>({
        resource: 'users',
        id,
      });

      return jsonResponse(data);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'User not found', 404);
    }
  }

  // POST /api/users - Create user
  if (method === 'POST' && pathParts.length === 2) {
    try {
      const body = await request.json() as UserInsert;

      // Validation
      if (!body.name || !body.email) {
        return errorResponse('Name and email are required', 400);
      }

      const { data } = await dataProvider.create<User, UserInsert>({
        resource: 'users',
        variables: {
          ...body,
          createdAt: new Date(),
        },
      });

      return jsonResponse(data, 201);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to create user', 500);
    }
  }

  // POST /api/users/batch - Batch create users
  if (method === 'POST' && pathParts[2] === 'batch') {
    try {
      const body = await request.json() as { users: UserInsert[] };

      if (!Array.isArray(body.users) || body.users.length === 0) {
        return errorResponse('Users array is required', 400);
      }

      // Add timestamps
      const usersWithTimestamps = body.users.map(user => ({
        ...user,
        createdAt: new Date(),
      }));

      const data = await batchInsert<User>(
        dataProvider,
        'users',
        usersWithTimestamps
      );

      return jsonResponse({ data, count: data.length }, 201);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to batch create users', 500);
    }
  }

  // PUT /api/users/:id - Update user
  if (method === 'PUT' && pathParts.length === 3) {
    try {
      const id = parseInt(pathParts[2]);
      if (isNaN(id)) {
        return errorResponse('Invalid user ID', 400);
      }

      const body = await request.json() as Partial<UserInsert>;

      const { data } = await dataProvider.update<User>({
        resource: 'users',
        id,
        variables: {
          ...body,
          updatedAt: new Date(),
        },
      });

      return jsonResponse(data);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to update user', 500);
    }
  }

  // DELETE /api/users/:id - Delete user
  if (method === 'DELETE' && pathParts.length === 3) {
    try {
      const id = parseInt(pathParts[2]);
      if (isNaN(id)) {
        return errorResponse('Invalid user ID', 400);
      }

      await dataProvider.deleteOne({
        resource: 'users',
        id,
      });

      return jsonResponse({ success: true, id });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to delete user', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
