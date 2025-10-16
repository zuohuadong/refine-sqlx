/**
 * v0.5.0 - JSON Field Parser
 *
 * Automatically detects and parses JSON columns from schema
 */

import type { BaseRecord } from '@refinedev/core';
import type { JSONConfig } from '../../config';
import type { FeatureExecutor } from '../index';

/**
 * JSON field parser with auto-detection
 */
export class JSONParser implements FeatureExecutor {
  readonly name = 'json';
  readonly enabled: boolean;

  private jsonColumns = new Map<string, Set<string>>();
  private readonly parseDepth: number;
  private readonly strict: boolean;

  constructor(
    private schema: Record<string, unknown>,
    private config: JSONConfig,
  ) {
    this.enabled = config.enabled;
    this.parseDepth = config.parseDepth ?? 10;
    this.strict = config.strict ?? false;
  }

  /**
   * Initialize JSON parser - detect JSON columns from schema
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    if (this.config.autoDetect ?? true) {
      this.detectJSONColumns();
    }
  }

  /**
   * Detect JSON columns from Drizzle schema
   */
  private detectJSONColumns(): void {
    for (const [tableName, table] of Object.entries(this.schema)) {
      if (!table || typeof table !== 'object') continue;

      const jsonCols = new Set<string>();

      // Access table columns
      const tableObj = table as any;
      const columns = tableObj._ ?? tableObj;

      for (const [colName, column] of Object.entries(columns)) {
        if (this.isJSONColumn(column)) {
          jsonCols.add(colName);
        }
      }

      if (jsonCols.size > 0) {
        this.jsonColumns.set(tableName, jsonCols);
      }
    }
  }

  /**
   * Check if a column is a JSON type
   */
  private isJSONColumn(column: any): boolean {
    if (!column || typeof column !== 'object') return false;

    // Check Drizzle column type
    const dataType = column.dataType as string | undefined;
    const columnType = column.columnType as string | undefined;

    return (
      dataType === 'json' ||
      dataType === 'jsonb' ||
      columnType?.includes('json') ||
      columnType?.includes('JSON') ||
      false
    );
  }

  /**
   * Parse JSON fields in a single record
   */
  parseResult<T extends BaseRecord>(resource: string, data: T): T {
    if (!this.enabled) return data;

    const jsonCols = this.jsonColumns.get(resource);
    if (!jsonCols || jsonCols.size === 0) return data;

    const parsed: any = { ...data };

    for (const col of jsonCols) {
      if (col in parsed && typeof parsed[col] === 'string') {
        try {
          parsed[col] = this.parseJSON(parsed[col]);
        } catch (error) {
          if (this.strict) {
            throw new Error(
              `[refine-sqlx] Failed to parse JSON column '${col}' in '${resource}': ${error}`,
            );
          }
          console.warn(
            `[refine-sqlx] JSON parse warning for ${resource}.${col}:`,
            error,
          );
        }
      }
    }

    return parsed as T;
  }

  /**
   * Parse JSON fields in multiple records
   */
  parseResults<T extends BaseRecord>(resource: string, data: T[]): T[] {
    if (!this.enabled) return data;
    return data.map((item) => this.parseResult(resource, item));
  }

  /**
   * Serialize data before insert/update
   */
  serializeData<T extends BaseRecord>(resource: string, data: T): T {
    if (!this.enabled) return data;

    const jsonCols = this.jsonColumns.get(resource);
    if (!jsonCols || jsonCols.size === 0) return data;

    const serialized: any = { ...data };

    for (const col of jsonCols) {
      if (col in serialized && typeof serialized[col] !== 'string') {
        try {
          serialized[col] = JSON.stringify(serialized[col]);
        } catch (error) {
          if (this.strict) {
            throw new Error(
              `[refine-sqlx] Failed to serialize JSON column '${col}' in '${resource}': ${error}`,
            );
          }
          console.warn(
            `[refine-sqlx] JSON serialization warning for ${resource}.${col}:`,
            error,
          );
        }
      }
    }

    return serialized as T;
  }

  /**
   * Parse JSON string with depth limiting
   */
  private parseJSON(value: string, depth = 0): any {
    if (depth > this.parseDepth) {
      throw new Error(
        `[refine-sqlx] JSON parse depth exceeded: ${this.parseDepth}`,
      );
    }

    const parsed = JSON.parse(value);

    // Recursively check depth for nested objects/arrays
    if (typeof parsed === 'object' && parsed !== null) {
      for (const key in parsed) {
        if (typeof parsed[key] === 'object' && parsed[key] !== null) {
          this.validateDepth(parsed[key], depth + 1);
        }
      }
    }

    return parsed;
  }

  /**
   * Validate object depth
   */
  private validateDepth(obj: any, depth: number): void {
    if (depth > this.parseDepth) {
      throw new Error(
        `[refine-sqlx] JSON object depth exceeded: ${this.parseDepth}`,
      );
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.validateDepth(obj[key], depth + 1);
        }
      }
    }
  }

  /**
   * Manually register a JSON column
   */
  registerJSONColumn(resource: string, columnName: string): void {
    if (!this.jsonColumns.has(resource)) {
      this.jsonColumns.set(resource, new Set());
    }
    this.jsonColumns.get(resource)!.add(columnName);
  }

  /**
   * Check if a column is registered as JSON
   */
  isJSONColumnRegistered(resource: string, columnName: string): boolean {
    return this.jsonColumns.get(resource)?.has(columnName) ?? false;
  }

  /**
   * Get all JSON columns for a resource
   */
  getJSONColumns(resource: string): string[] {
    return Array.from(this.jsonColumns.get(resource) ?? []);
  }
}
