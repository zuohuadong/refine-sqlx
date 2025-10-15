# Cloudflare D1 Worker Example

This example demonstrates how to use `refine-sqlx` with Cloudflare D1 in a Workers environment.

## Features

- ✅ Optimized D1 build (`refine-sqlx/d1`)
- ✅ Type-safe schema with Drizzle ORM
- ✅ Complete REST API for users and posts
- ✅ Automatic pagination and filtering
- ✅ Error handling

## Setup

### 1. Install Dependencies

```bash
npm install refine-sqlx drizzle-orm
npm install -D wrangler @cloudflare/workers-types
```

### 2. Configure wrangler.toml

```toml
name = "refine-sqlx-d1-example"
main = "example/d1-worker.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "refine-sqlx-demo"
database_id = "your-database-id"
```

### 3. Create D1 Database

```bash
# Create database
wrangler d1 create refine-sqlx-demo

# Copy the database_id to wrangler.toml
```

### 4. Initialize Database

```bash
# Start local development
wrangler dev

# Initialize tables (POST to /init)
curl -X POST http://localhost:8787/init
```

## API Endpoints

### Users

- `GET /users?page=1&pageSize=10&status=active` - List users with pagination and filtering
- `GET /users/:id` - Get single user
- `POST /users` - Create user
  ```json
  { "name": "John Doe", "email": "john@example.com", "status": "active" }
  ```
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Posts

- `GET /posts?page=1&pageSize=10` - List posts
- `POST /posts` - Create post
  ```json
  {
    "title": "My Post",
    "content": "Post content...",
    "userId": 1,
    "status": "published"
  }
  ```

### Initialization

- `POST /init` - Initialize database schema and sample data

## Deploy

```bash
# Build
npm run build

# Deploy to Cloudflare
wrangler deploy
```

## Bundle Size

The D1-optimized build is extremely small:

- **16 KB total** (main + shared chunks)
- **~5 KB gzipped**
- Perfect for Cloudflare Workers 1MB limit

## Performance

- **Fast cold starts** - Minimal bundle size
- **Type-safe queries** - Drizzle ORM type inference
- **Atomic transactions** - D1 batch API with rollback support
