# Deployment Guide

Deploy `refine-sqlx` applications to production.

## Cloudflare Workers (D1)

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- D1 database created

### Deployment Steps

```bash
# 1. Build your application
npm run build

# 2. Apply migrations to production database
D1_DATABASE_NAME=my-app-db-prod npm run db:migrate

# 3. Deploy to Cloudflare Workers
npm run deploy

# Or deploy to specific environment
npm run deploy -- --env production
```

### Environment Configuration

Create separate environments in `wrangler.toml`:

```toml
name = "my-app"
main = "src/index.ts"

# Development
[[d1_databases]]
binding = "DB"
database_name = "my-app-dev"
database_id = "dev-database-id"

# Production
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "my-app-prod"
database_id = "prod-database-id"

# Staging
[env.staging]
[[env.staging.d1_databases]]
binding = "DB"
database_name = "my-app-staging"
database_id = "staging-database-id"
```

### CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Apply migrations
        run: npm run db:migrate
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy to Cloudflare Workers
        run: npm run deploy -- --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Best Practices

1. **Use Separate Databases** for dev/staging/prod
2. **Test Migrations** in staging before production
3. **Monitor Performance** with Cloudflare Analytics
4. **Set Up Alerts** for errors and performance issues
5. **Use Environment Variables** for secrets
6. **Enable Time Travel** for easy rollbacks
7. **Implement Health Checks** for monitoring

### Health Check Endpoint

```typescript
app.get('/health', async (c) => {
  try {
    // Test database connection
    const dataProvider = c.get('dataProvider');
    await dataProvider.getList({ resource: 'users', pagination: { current: 1, pageSize: 1 } });

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message,
    }, 503);
  }
});
```

### Monitoring

Use Cloudflare's built-in analytics:

```bash
# View logs
wrangler tail my-app --env production

# View metrics
wrangler deployments list my-app
```

## Node.js / Bun

### PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "my-app" -- start

# Production mode
pm2 start npm --name "my-app" -- start --env production

# Auto-restart on file changes
pm2 start npm --name "my-app" -- run dev --watch

# View logs
pm2 logs my-app

# Monitor
pm2 monit
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM oven/bun:1 AS builder

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["bun", "run", "start"]
```

```bash
# Build
docker build -t my-app .

# Run
docker run -p 3000:3000 -v $(pwd)/data:/app/data my-app

# Docker Compose
docker-compose up -d
```

### systemd Service

```ini
# /etc/systemd/system/my-app.service
[Unit]
Description=My refine-sqlx App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/my-app
ExecStart=/usr/bin/bun run start
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable my-app
sudo systemctl start my-app

# Check status
sudo systemctl status my-app
```

## Vercel / Netlify

While `refine-sqlx` is optimized for edge runtimes, you can deploy to traditional platforms:

```typescript
// Use better-sqlite3 adapter
import { createRefineSQL } from 'refine-sqlx';
import Database from 'better-sqlite3';

const db = new Database('./data/app.db');
const dataProvider = createRefineSQL({ connection: db, schema });
```

## Production Checklist

- [ ] Separate databases for environments
- [ ] Migrations tested in staging
- [ ] Environment variables configured
- [ ] Health checks implemented
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place
- [ ] Error logging configured
- [ ] Performance optimization applied
- [ ] Security review completed
- [ ] Documentation updated

## Resources

- [Cloudflare Workers Deployment](https://developers.cloudflare.com/workers/platform/deployments/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Docker Documentation](https://docs.docker.com/)

---

**Last Updated**: 2025-10-15
