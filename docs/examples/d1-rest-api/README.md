# D1 REST API Template

Complete REST API example using `refine-sqlx` with Cloudflare D1.

## Features

- ✅ Complete CRUD operations
- ✅ Advanced filtering and sorting
- ✅ Pagination support
- ✅ Batch operations
- ✅ Type-safe with TypeScript
- ✅ Error handling
- ✅ Input validation
- ✅ API documentation

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Cloudflare D1

```bash
# Create D1 database
npx wrangler d1 create my-app-db

# Update wrangler.toml with database_id
```

### 3. Run Migrations

```bash
# Apply schema
npm run db:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

## API Endpoints

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users with pagination |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create new user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| POST | `/api/users/batch` | Batch create users |

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | List posts with filters |
| GET | `/api/posts/:id` | Get post by ID |
| POST | `/api/posts` | Create new post |
| PUT | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |

## Example Requests

### List Users with Filters

```bash
curl "http://localhost:8787/api/users?page=1&pageSize=10&status=active&sort=-createdAt"
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 10
}
```

### Create User

```bash
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "status": "active"
  }'
```

### Batch Create Users

```bash
curl -X POST http://localhost:8787/api/users/batch \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {"name": "User 1", "email": "user1@example.com", "status": "active"},
      {"name": "User 2", "email": "user2@example.com", "status": "active"}
    ]
  }'
```

### Filter Posts

```bash
# Get published posts by specific author
curl "http://localhost:8787/api/posts?userId=1&status=published&sort=-publishedAt"

# Search posts by title
curl "http://localhost:8787/api/posts?title_contains=typescript"
```

## Project Structure

```
d1-rest-api/
├── src/
│   ├── index.ts              # Main worker entry
│   ├── schema.ts             # Drizzle schema definitions
│   ├── routes/
│   │   ├── users.ts          # User endpoints
│   │   └── posts.ts          # Post endpoints
│   ├── middleware/
│   │   ├── auth.ts           # Authentication
│   │   ├── validation.ts     # Input validation
│   │   └── error.ts          # Error handling
│   └── utils/
│       ├── response.ts       # API response helpers
│       └── validation.ts     # Validation schemas
├── test/
│   ├── users.test.ts         # User endpoint tests
│   └── posts.test.ts         # Post endpoint tests
├── migrations/
│   └── 0000_initial.sql      # Database migrations
├── package.json
├── wrangler.toml
├── tsconfig.json
└── README.md
```

## Schema

### Users Table

```typescript
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status', { enum: ['active', 'inactive', 'suspended'] })
    .notNull()
    .default('active'),
  role: text('role', { enum: ['user', 'admin', 'moderator'] })
    .notNull()
    .default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

### Posts Table

```typescript
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  status: text('status', { enum: ['draft', 'published', 'archived'] })
    .notNull()
    .default('draft'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

## Configuration

### Environment Variables

Create `.env` file:

```env
# Cloudflare Account
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# D1 Database
CLOUDFLARE_DATABASE_ID=your-database-id
D1_DATABASE_NAME=my-app-db
```

### wrangler.toml

```toml
name = "d1-rest-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[[d1_databases]]
binding = "DB"
database_name = "my-app-db"
database_id = "your-database-id"

[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "my-app-db-prod"
database_id = "your-prod-database-id"
```

## Advanced Features

### Filtering

Support for multiple filter operators:

```typescript
// In your request
{
  filters: [
    { field: 'status', operator: 'eq', value: 'active' },
    { field: 'name', operator: 'contains', value: 'john' },
    { field: 'createdAt', operator: 'gte', value: '2024-01-01' }
  ]
}
```

### Sorting

```typescript
// Sort by multiple fields
{
  sorters: [
    { field: 'createdAt', order: 'desc' },
    { field: 'name', order: 'asc' }
  ]
}
```

### Pagination

```typescript
// Standard pagination
{
  pagination: {
    current: 1,
    pageSize: 20
  }
}
```

## Deployment

### Deploy to Production

```bash
# Build
npm run build

# Deploy
npm run deploy
```

### Deploy with GitHub Actions

The template includes a GitHub Actions workflow for automatic deployment:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test users.test.ts
```

## Performance

- **Bundle Size**: ~66KB uncompressed, ~18KB gzipped
- **Cold Start**: <50ms
- **Response Time**: <10ms (avg)

## Best Practices

1. **Use Batch Operations** for bulk inserts/updates
2. **Index Frequently Queried Fields** for better performance
3. **Validate Input** on all POST/PUT endpoints
4. **Handle Errors Gracefully** with proper status codes
5. **Use Pagination** for large datasets
6. **Cache Static Data** where appropriate

## Troubleshooting

### Common Issues

**Issue**: `DB is not defined`

**Solution**: Check `wrangler.toml` D1 binding matches your code:
```toml
[[d1_databases]]
binding = "DB"  # Must match env.DB
```

**Issue**: Migration fails

**Solution**: Reset database:
```bash
npx wrangler d1 execute my-app-db --command="DROP TABLE IF EXISTS users"
npm run db:migrate
```

## Resources

- [Main Documentation](../../../README.md)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Refine Documentation](https://refine.dev/docs)

## License

MIT
