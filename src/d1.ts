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
