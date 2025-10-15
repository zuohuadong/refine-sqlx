import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { DataProvider } from '@refinedev/core';
import type { User } from '../schema';
import { authMiddleware } from '../middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: { dataProvider: DataProvider } }>();

// Validation schemas
const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  role: z.enum(['user', 'admin', 'moderator']).optional(),
});

const updateUserSchema = userSchema.partial();

// GET /api/users - List users
app.get('/', async (c) => {
  const dataProvider = c.get('dataProvider');

  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '10');
  const status = c.req.query('status');
  const sort = c.req.query('sort') || '-createdAt';

  const filters = [];
  if (status) {
    filters.push({ field: 'status', operator: 'eq' as const, value: status });
  }

  const sorters = sort.startsWith('-')
    ? [{ field: sort.substring(1), order: 'desc' as const }]
    : [{ field: sort, order: 'asc' as const }];

  const { data, total } = await dataProvider.getList<User>({
    resource: 'users',
    pagination: { current: page, pageSize },
    filters,
    sorters,
  });

  return c.json({
    data,
    total,
    page,
    pageSize,
  });
});

// GET /api/users/:id - Get user
app.get('/:id', async (c) => {
  const dataProvider = c.get('dataProvider');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  const { data } = await dataProvider.getOne<User>({
    resource: 'users',
    id,
  });

  return c.json(data);
});

// POST /api/users - Create user (with validation)
app.post('/', zValidator('json', userSchema), async (c) => {
  const dataProvider = c.get('dataProvider');
  const body = c.req.valid('json');

  const { data } = await dataProvider.create<User>({
    resource: 'users',
    variables: {
      ...body,
      createdAt: new Date(),
    },
  });

  return c.json(data, 201);
});

// PUT /api/users/:id - Update user (protected)
app.put('/:id', authMiddleware, zValidator('json', updateUserSchema), async (c) => {
  const dataProvider = c.get('dataProvider');
  const id = parseInt(c.req.param('id'));
  const body = c.req.valid('json');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  const { data } = await dataProvider.update<User>({
    resource: 'users',
    id,
    variables: {
      ...body,
      updatedAt: new Date(),
    },
  });

  return c.json(data);
});

// DELETE /api/users/:id - Delete user (protected, admin only)
app.delete('/:id', authMiddleware, async (c) => {
  const dataProvider = c.get('dataProvider');
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  await dataProvider.deleteOne({
    resource: 'users',
    id,
  });

  return c.json({ success: true, id });
});

export const usersRoutes = app;
