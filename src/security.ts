/**
 * Security layer for refine-sqlx
 *
 * Provides table-level, field-level, and operation-level access control
 */

/**
 * Security configuration
 */
export interface SecurityConfig {
    /**
     * Allowed tables (whitelist)
     * If specified, only these tables can be accessed
     * @default undefined (all tables allowed)
     */
    allowedTables?: string[];

    /**
     * Hidden fields per table
     * These fields will be stripped from query results
     *
     * @example
     * ```typescript
     * hiddenFields: {
     *   users: ['password', 'apiKey']
     * }
     * ```
     */
    hiddenFields?: Record<string, string[]>;

    /**
     * Maximum number of records per query
     * Prevents abuse via large result sets
     * @default undefined (no limit)
     */
    maxLimit?: number;

    /**
     * Allowed CRUD operations
     * If specified, only these operations are permitted
     * @default undefined (all operations allowed)
     */
    allowedOperations?: Array<'read' | 'create' | 'update' | 'delete'>;
}

type CrudOperation = 'read' | 'create' | 'update' | 'delete';

/**
 * Security guard that enforces access control rules
 */
export class SecurityGuard {
    private readonly config: SecurityConfig;

    constructor(config: SecurityConfig) {
        this.config = config;
    }

    /**
     * Check if a table is accessible
     * @throws Error if the table is not in the allowedTables whitelist
     */
    checkTableAccess(resource: string): void {
        if (
            this.config.allowedTables &&
            !this.config.allowedTables.includes(resource)
        ) {
            throw new Error(
                `[refine-sqlx] Access denied: table "${resource}" is not in the allowed tables list`,
            );
        }
    }

    /**
     * Check if an operation is allowed
     * @throws Error if the operation is not permitted
     */
    checkOperation(operation: CrudOperation, resource: string): void {
        if (
            this.config.allowedOperations &&
            !this.config.allowedOperations.includes(operation)
        ) {
            throw new Error(
                `[refine-sqlx] Access denied: "${operation}" operation is not allowed on "${resource}"`,
            );
        }
    }

    /**
     * Enforce maxLimit on pagination
     * Returns the effective limit (capped by maxLimit if configured)
     */
    enforceMaxLimit(limit: number): number {
        if (this.config.maxLimit && limit > this.config.maxLimit) {
            return this.config.maxLimit;
        }
        return limit;
    }

    /**
     * Strip hidden fields from a single record
     */
    stripHiddenFields<T extends Record<string, unknown>>(
        resource: string,
        record: T,
    ): T {
        const hiddenFields = this.config.hiddenFields?.[resource];
        if (!hiddenFields || hiddenFields.length === 0) {
            return record;
        }

        const result = { ...record };
        for (const field of hiddenFields) {
            delete result[field];
        }
        return result;
    }

    /**
     * Strip hidden fields from an array of records
     */
    stripHiddenFieldsFromList<T extends Record<string, unknown>>(
        resource: string,
        records: T[],
    ): T[] {
        const hiddenFields = this.config.hiddenFields?.[resource];
        if (!hiddenFields || hiddenFields.length === 0) {
            return records;
        }

        return records.map((record) => this.stripHiddenFields(resource, record));
    }
}
