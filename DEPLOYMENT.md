# Deployment Guide

This guide will help you deploy your refine-d1 project to Cloudflare Workers.

## Prerequisites

1. Install Node.js (>=20)
2. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```
3. Login to Cloudflare:
   ```bash
   wrangler login
   ```

## Step 1: Create D1 Database

```bash
# Create a new D1 database
wrangler d1 create your-database-name

# Note the returned database ID, for example:
# ✅ Successfully created DB 'your-database-name' in region APAC
# Created your database using D1's new storage backend.
# The new D1 storage backend is not yet recommended for production workloads, 
# but backs up your data via point-in-time restore.
# 
# [[d1_databases]]
# binding = "DB" # i.e. available in your Worker on env.DB
# database_name = "your-database-name"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Step 2: Update wrangler.toml

Add the returned configuration to your `wrangler.toml` file:

```toml
name = "refine-d1-worker"
main = "src/worker.ts"
compatibility_date = "2024-08-15"

[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Replace with your database ID
```

## Step 3: Execute Database Migration

```bash
# Execute initial migration
wrangler d1 execute your-database-name --file=./migrations/001_initial.sql

# Verify data
wrangler d1 execute your-database-name --command="SELECT * FROM posts LIMIT 5"
```

## Step 4: Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev:worker

# Or use wrangler directly
wrangler dev
```

Visit `http://localhost:8787` to test your API.

## Step 5: Deploy to Production

```bash
# Build the project
npm run build

# Deploy to Cloudflare Workers
npm run deploy:worker

# Or use wrangler directly
wrangler deploy
```

## API Endpoints

After deployment, your Worker will provide the following API endpoints:

- `GET /` - View available endpoints
- `GET /api/{resource}` - Get resource list
- `GET /api/{resource}/{id}` - Get single resource
- `POST /api/{resource}` - Create new resource
- `PUT /api/{resource}/{id}` - Update resource
- `DELETE /api/{resource}/{id}` - Delete resource

### Example Requests

```bash
# Get all posts
curl https://your-worker.your-subdomain.workers.dev/api/posts

# Get specific post
curl https://your-worker.your-subdomain.workers.dev/api/posts/1

# Create new post
curl -X POST https://your-worker.your-subdomain.workers.dev/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"New Post","content":"Post content","category_id":1,"published":true}'

# Update post
curl -X PUT https://your-worker.your-subdomain.workers.dev/api/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'

# Delete post
curl -X DELETE https://your-worker.your-subdomain.workers.dev/api/posts/1
```

## Environment Configuration

### Development Environment

In development, you can use a local D1 database:

```bash
# Create local database
wrangler d1 execute your-database-name --local --file=./migrations/001_initial.sql

# Use --local flag for local development
wrangler dev --local
```

### Production Environment

Production will automatically use Cloudflare's edge database.

## Monitoring and Debugging

```bash
# View Worker logs
wrangler tail

# View D1 database info
wrangler d1 info your-database-name

# Execute queries to check data
wrangler d1 execute your-database-name --command="SELECT COUNT(*) as count FROM posts"
```

## Troubleshooting

### Common Issues

1. **Database not found**: Ensure the database ID in `wrangler.toml` is correct
2. **Permission denied**: Ensure you're logged into the correct Cloudflare account
3. **Build errors**: Ensure all dependencies are properly installed

### Debugging Steps

1. Check `wrangler.toml` configuration
2. Verify database exists: `wrangler d1 list`
3. Check local build: `npm run build`
4. Test with local mode: `wrangler dev --local`

## Best Practices

1. **Backup Data**: Regularly backup your D1 database
2. **Error Handling**: Implement proper error handling in your Worker
3. **Caching**: Consider using Cloudflare Cache to improve performance
4. **Security**: Implement proper authentication and authorization
5. **Monitoring**: Set up monitoring and alerts to track API usage

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Refine Framework Documentation](https://refine.dev/)
