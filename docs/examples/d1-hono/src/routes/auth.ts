import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sign, verify } from 'hono/jwt';
import type { DataProvider } from '@refinedev/core';
import type { User } from '../schema';

const app = new Hono<{ Bindings: Env; Variables: { dataProvider: DataProvider } }>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

// POST /auth/login
app.post('/login', zValidator('json', loginSchema), async (c) => {
  const dataProvider = c.get('dataProvider');
  const { email, password } = c.req.valid('json');

  // In production, use proper password hashing (bcrypt, argon2, etc.)
  const { data: users } = await dataProvider.getList<User>({
    resource: 'users',
    filters: [{ field: 'email', operator: 'eq', value: email }],
    pagination: { current: 1, pageSize: 1 },
  });

  if (users.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const user = users[0];

  // Generate JWT token
  const token = await sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    c.env.JWT_SECRET
  );

  return c.json({ token, user });
});

// POST /auth/register
app.post('/register', zValidator('json', registerSchema), async (c) => {
  const dataProvider = c.get('dataProvider');
  const { name, email, password } = c.req.valid('json');

  // In production, hash the password before storing
  const { data: user } = await dataProvider.create<User>({
    resource: 'users',
    variables: {
      name,
      email,
      status: 'active',
      role: 'user',
      createdAt: new Date(),
    },
  });

  // Generate JWT token
  const token = await sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
    c.env.JWT_SECRET
  );

  return c.json({ token, user }, 201);
});

// GET /auth/me (requires authentication)
app.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    const dataProvider = c.get('dataProvider');

    const { data: user } = await dataProvider.getOne<User>({
      resource: 'users',
      id: payload.userId as number,
    });

    return c.json(user);
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

export const authRoutes = app;
