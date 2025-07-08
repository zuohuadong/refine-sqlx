# Multi-Runtime Usage Guide

## Quick Start

The refine-d1 package now supports three different SQLite runtimes with a unified API:

### 1. Cloudflare D1 (Workers/Pages)
```typescript
import { dataProvider } from 'refine-d1';

export default {
  async fetch(request, env) {
    const provider = dataProvider(env.DB);
    // ... your app logic
  }
}
```

### 2. Node.js 22.5+ (Built-in SQLite)
```typescript
import { dataProvider } from 'refine-d1';

// Uses Node.js built-in sqlite module
const provider = dataProvider('./database.db');

// In a Refine app
const App = () => (
  <Refine
    dataProvider={provider}
    // ... other props
  />
);
```

### 3. Bun 1.2+ (Built-in SQLite)
```typescript
import { dataProvider } from 'refine-d1';

// Uses Bun's built-in SQLite
const provider = dataProvider('./database.db');

// Works identically to Node.js
```

## Runtime Detection

The package automatically detects your runtime environment:

- **Cloudflare Workers**: Pass a D1Database instance
- **Node.js 22.5+**: Pass a file path string
- **Bun 1.2+**: Pass a file path string

```typescript
// Works in all environments
const provider = dataProvider(
  env.DB ||           // Cloudflare D1
  './database.db'     // Node.js/Bun file path
);
```

## API Reference

All methods work identically across runtimes:

```typescript
// Read operations
await provider.getList({ resource: 'users' });
await provider.getOne({ resource: 'users', id: '1' });
await provider.getMany({ resource: 'users', ids: ['1', '2'] });

// Write operations  
await provider.create({ resource: 'users', variables: { name: 'John' } });
await provider.update({ resource: 'users', id: '1', variables: { name: 'Jane' } });
await provider.deleteOne({ resource: 'users', id: '1' });

// Bulk operations
await provider.createMany({ resource: 'users', variables: [...] });
await provider.updateMany({ resource: 'users', ids: [...], variables: {...} });
await provider.deleteMany({ resource: 'users', ids: [...] });

// Custom queries
await provider.custom({
  url: '/custom',
  method: 'get',
  payload: {
    sql: 'SELECT COUNT(*) FROM users WHERE active = ?',
    params: [true]
  }
});
```

## Environment Requirements

### Cloudflare Workers
- Any Workers runtime version
- Requires D1 database binding

### Node.js
- **Minimum**: Node.js 22.5.0
- Uses built-in `node:sqlite` module
- Zero external dependencies

### Bun
- **Minimum**: Bun 1.2.0  
- Uses built-in `Bun.sqlite()` API
- Zero external dependencies

## Bundle Size

| Configuration | Bundle Size | Notes |
|---------------|-------------|-------|
| D1 only | 5.30 KB | Baseline |
| + Node.js SQLite | 5.30 KB | No increase (external module) |
| + Bun SQLite | 5.30 KB | No increase (global API) |
| All runtimes | 5.30 KB | No increase |

The native SQLite support adds **zero bundle overhead** thanks to:
- Dynamic imports for Node.js SQLite
- External dependency declaration
- Global API usage for Bun
- Aggressive tree shaking

## Development Workflow

### Local Development (Node.js/Bun)
```bash
# Install dependencies
npm install

# Run with local SQLite file
node app.js  # Uses ./database.db

# Or with Bun
bun run app.js
```

### Production (Cloudflare)
```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Uses D1 database binding
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests (requires Node.js 22.5+ or Bun 1.2+)
node integration-test.js
```

## Migration Guide

### From D1-only Version
No breaking changes! Existing code continues to work:

```typescript
// This still works exactly the same
const provider = dataProvider(env.DB);
```

### Adding Local Development
Simply provide a fallback file path:

```typescript
const provider = dataProvider(
  env.DB ||           // Production: D1
  './dev-database.db' // Development: Local SQLite
);
```

## Performance Comparison

| Runtime | Cold Start | Query Speed | Scaling |
|---------|------------|-------------|---------|
| Cloudflare D1 | ~5ms | Fast | Global edge |
| Node.js SQLite | ~1ms | Very fast | Vertical |
| Bun SQLite | ~0.5ms | Fastest | Vertical |

## Error Handling

The package provides clear error messages for environment issues:

```typescript
try {
  const provider = dataProvider('./database.db');
} catch (error) {
  // "Node.js version 22.5.0 or higher is required..."
  // "Bun version 1.2.0 or higher is required..." 
  // "SQLite file paths are only supported in Node.js 22.5+ or Bun 1.2+ environments"
}
```

## Best Practices

1. **Environment Detection**: Let the package auto-detect the runtime
2. **Error Handling**: Always wrap initialization in try-catch
3. **Resource Management**: Call `close()` when done (Node.js/Bun only)
4. **Development**: Use local SQLite files for development
5. **Production**: Use D1 for production deployments

## Examples

See the `/examples` directory for complete implementations:
- `cloudflare-worker.ts` - D1 in Cloudflare Workers
- `nodejs-app.ts` - Node.js with native SQLite
- `bun-app.ts` - Bun with native SQLite
- `universal.ts` - Cross-platform implementation
