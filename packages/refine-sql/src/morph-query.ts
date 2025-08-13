import type { BaseRecord } from '@refinedev/core';
import type { SqlClient } from './client';
import { SqlxChainQuery } from './chain-query';

// Polymorphic configuration
export interface MorphConfig {
  typeField: string;
  idField: string;
  relationName: string;
  types: Record<string, string>;
}

// Polymorphic query factory function
export function createMorphQuery<T extends BaseRecord = BaseRecord>(
  client: SqlClient,
  tableName: string,
  morphConfig: MorphConfig
): SqlxChainQuery<T> {
  const query = new SqlxChainQuery<T>(client, tableName);
  (query as any)._morphConfig = morphConfig;
  return query;
}

// Polymorphic query class
export class SqlxMorphQuery<T extends BaseRecord = BaseRecord> extends SqlxChainQuery<T> {
  constructor(client: SqlClient, tableName: string, private morphConfig: MorphConfig) {
    super(client, tableName);
  }

  getMorphConfig(): MorphConfig {
    return this.morphConfig;
  }
}