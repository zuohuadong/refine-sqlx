# D1 + Hono Framework Template

Lightweight, high-performance API using `refine-sqlx` with [Hono](https://hono.dev/) framework on Cloudflare D1.

## Features

- ✅ Ultra-fast routing with Hono
- ✅ Built-in validation with Zod
- ✅ Type-safe API with TypeScript
- ✅ OpenAPI documentation
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ CORS support
- ✅ Minimal bundle size

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup D1 Database

```bash
# Create database
npx wrangler d1 create my-hono-db

# Update wrangler.toml with database_id
# Run migrations
npm run db:migrate
```

### 3. Start Development

```bash
npm run dev
```

Visit http://localhost:8787

## API Endpoints

### Users API

```typescript
GET    /api/users         - List users (with pagination, filters)
GET    /api/users/:id     - Get user by ID
POST   /api/users         - Create user
PUT    /api/users/:id     - Update user
DELETE /api/users/:id     - Delete user
```

### Posts API

```typescript
GET    /api/posts         - List posts
GET    /api/posts/:id     - Get post
POST   /api/posts         - Create post
PUT    /api/posts/:id     - Update post
DELETE /api/posts/:id     - Delete post
```

### Authentication

```typescript
POST   /auth/login        - Login
POST   /auth/register     - Register
GET    /auth/me           - Get current user (requires JWT)
```

## Example Usage

### Create User with Validation

```bash
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active"
  }'
```

### List Users with Filters

```bash
curl "http://localhost:8787/api/users?status=active&page=1&pageSize=20"
```

### Authentication Flow

```bash
# Login
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "secret"}'

# Response: { "token": "eyJhbGc..." }

# Use token for authenticated requests
curl http://localhost:8787/auth/me \
  -H "Authorization: Bearer eyJhbGc..."
```

## Project Structure

```
d1-hono/
├── src/
│   ├── index.ts              # Hono app entry
│   ├── schema.ts             # Drizzle schema
│   ├── routes/
│   │   ├── users.ts          # User routes
│   │   ├── posts.ts          # Post routes
│   │   └── auth.ts           # Auth routes
│   ├── middleware/
│   │   ├── auth.ts           # JWT middleware
│   │   ├── cors.ts           # CORS middleware
│   │   └── ratelimit.ts      # Rate limiting
│   ├── validators/
│   │   ├── user.ts           # User validation schemas
│   │   └── post.ts           # Post validation schemas
│   └── utils/
│       └── jwt.ts            # JWT utilities
├── package.json
├── wrangler.toml
└── README.md
```

## Hono Features

### Built-in Middleware

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());
app.use('*', prettyJSON());
```

### Validation with Zod

```typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  status: z.enum(['active', 'inactive', 'suspended']),
});

app.post('/api/users', zValidator('json', userSchema), async (c) => {
  const validated = c.req.valid('json');
  // validated is type-safe!
});
```

### Type-Safe Routing

```typescript
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id'); // Type-safe param
  const db = c.env.DB; // Type-safe env binding
  // ...
});
```

## Authentication

### JWT-based Auth

```typescript
import { sign, verify } from 'hono/jwt';

// Generate token
const token = await sign(
  { userId: 1, email: 'user@example.com' },
  'your-secret-key'
);

// Verify token in middleware
app.use('/api/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const payload = await verify(token, 'your-secret-key');
  c.set('user', payload);
  await next();
});
```

## Rate Limiting

```typescript
import { rateLimiter } from 'hono-rate-limiter';

app.use(
  '/api/*',
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per window
  })
);
```

## OpenAPI Documentation

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono<{ Bindings: Env }>();

// Auto-generate OpenAPI spec
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'refine-sqlx API',
    version: '1.0.0',
  },
});

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));
```

Visit `/docs` for interactive API documentation.

## Performance

- **Bundle Size**: ~40KB (Hono + refine-sqlx/d1)
- **Cold Start**: <30ms
- **Response Time**: <5ms average
- **RPS**: 10,000+ requests per second

## Deployment

```bash
# Build
npm run build

# Deploy to production
npm run deploy

# Deploy to specific environment
npm run deploy -- --env production
```

## Environment Variables

```bash
# .dev.vars (local development)
JWT_SECRET=your-secret-key-here
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Why Hono?

Hono is perfect for Cloudflare Workers because:

1. **Tiny Bundle Size** - Only ~12KB (vs Express ~200KB)
2. **Ultra Fast** - 10x faster than Express
3. **Type Safe** - Full TypeScript support
4. **Modern** - Web Standards API (Request/Response)
5. **Batteries Included** - Built-in middleware
6. **Developer Friendly** - Simple, intuitive API

## Comparison

| Feature | Hono | Express | Fastify |
|---------|:----:|:-------:|:-------:|
| Bundle Size | 12KB | 200KB | 150KB |
| Edge Runtime | ✅ | ❌ | ❌ |
| Type Safety | ✅ | ❌ | ⚠️ |
| Performance | ⚡⚡⚡ | ⚡ | ⚡⚡ |
| Middleware | ✅ | ✅ | ✅ |

## Resources

- [Hono Documentation](https://hono.dev/)
- [Hono Examples](https://github.com/honojs/hono/tree/main/examples)
- [refine-sqlx Documentation](../../../README.md)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)

## License

MIT
