/**
 * Zero-config shortcut API for Drizzle ORM
 *
 * Provides a simplified entry point when schema is already
 * attached to the Drizzle instance via `drizzle(client, { schema })`
 */

import type { DataProvider } from '@refinedev/core';
import { createRefineSQL } from './provider';
import type { RefineSQLConfig, VariableDrizzleDatabase } from './types';

/**
 * Shortcut options (subset of RefineSQLConfig without connection and schema)
 */
export type DrizzleDataProviderOptions = Omit<
    RefineSQLConfig,
    'connection' | 'schema'
>;

/**
 * Create a Refine DataProvider directly from a Drizzle instance
 *
 * The Drizzle instance must have been created with schema:
 * ```typescript
 * const db = drizzle(client, { schema });
 * ```
 *
 * @example
 * ```typescript
 * import { drizzleDataProvider } from 'refine-sqlx';
 * import { db } from './db';
 *
 * const dataProvider = await drizzleDataProvider(db);
 * ```
 *
 * @example With options
 * ```typescript
 * const dataProvider = await drizzleDataProvider(db, {
 *   softDelete: { enabled: true, field: 'deleted_at' },
 *   security: { allowedTables: ['users', 'posts'] },
 * });
 * ```
 */
export async function drizzleDataProvider(
    db: VariableDrizzleDatabase,
    options?: DrizzleDataProviderOptions,
): Promise<DataProvider> {
    // Extract schema from Drizzle internal state
    const internalDb = db as unknown as { _: { schema?: Record<string, unknown> } };
    const schema = internalDb._?.schema;

    if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
        throw new Error(
            '[refine-sqlx] Cannot extract schema from Drizzle instance. ' +
            'Make sure to pass schema when creating the Drizzle instance:\n' +
            '  const db = drizzle(client, { schema });\n\n' +
            'Or use createRefineSQL({ connection: db, schema }) instead.',
        );
    }

    // Transform Drizzle internal schema format to table-only schema
    // Drizzle stores schema entries as { table, columns, ... } objects
    const tableSchema: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
        if (value && typeof value === 'object' && 'table' in (value as Record<string, unknown>)) {
            tableSchema[key] = (value as Record<string, unknown>).table;
        } else {
            tableSchema[key] = value;
        }
    }

    return createRefineSQL({
        ...options,
        connection: db,
        schema: tableSchema,
    });
}
