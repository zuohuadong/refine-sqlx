/// <reference types='./cloudflare-workers-shim.d.ts' />
import type { D1Database } from '@cloudflare/workers-types';
import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { RefineSQLConfig } from './types';
import { createRefineSQL } from './provider';

/**
 * Cloudflare D1 optimized build
 *
 * This entry point provides a tree-shaken, optimized build specifically for
 * Cloudflare D1 environments.
 *
 * @example
 * ```typescript
 * import { createRefineSQL } from 'refine-sqlx/d1';
 * import { drizzle } from 'drizzle-orm/d1';
 * import * as schema from './schema';
 *
 * export default {
 *   async fetch(request: Request, env: { DB: D1Database }) {
 *     const db = drizzle(env.DB, { schema });
 *     const dataProvider = await createRefineSQL({
 *       connection: db,
 *       schema,
 *     });
 *
 *     return Response.json({ ok: true });
 *   },
 * };
 * ```
 */

export { createRefineSQL } from './provider';

export type {
  RefineSQLConfig,
  InferInsertModel,
  InferSelectModel,
  TableName,
  D1Options,
} from './types';

export {
  batchInsert,
  batchUpdate,
  batchDelete,
  DEFAULT_BATCH_SIZE,
} from './utils/batch';

/**
 * Convenience function to create a Refine DataProvider for Cloudflare D1
 *
 * This function automatically creates a Drizzle instance from the D1Database,
 * so you don't need to manually call `drizzle()`.
 *
 * @param d1Database - The D1Database instance from env.DB
 * @param config - Configuration options (schema is required)
 * @returns Refine DataProvider
 *
 * @example
 * ```typescript
 * import { createD1Provider } from 'refine-sqlx/d1';
 * import * as schema from './schema';
 *
 * export default {
 *   async fetch(request: Request, env: { DB: D1Database }) {
 *     const dataProvider = await createD1Provider(env.DB, {
 *       schema,
 *       d1Options: { batch: { maxSize: 50 } },
 *     });
 *
 *     const users = await dataProvider.getList({
 *       resource: 'users',
 *       pagination: { current: 1, pageSize: 10 },
 *     });
 *
 *     return Response.json(users);
 *   },
 * };
 * ```
 */
export async function createD1Provider<TSchema extends Record<string, unknown>>(
  d1Database: D1Database,
  config: Omit<RefineSQLConfig<TSchema>, 'connection'>,
): Promise<ReturnType<typeof createRefineSQL<TSchema>>> {
  const drizzleConfig: DrizzleConfig<TSchema> = {
    schema: config.schema,
  };

  const db = drizzleD1(d1Database, drizzleConfig);

  return createRefineSQL({
    ...config,
    connection: db as DrizzleD1Database<TSchema>,
  });
}
