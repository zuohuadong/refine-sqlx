/**
 * v0.5.0 - Extended DataProvider Types
 *
 * Type-safe extensions for DataProvider based on enabled features
 */

import type {
  BaseRecord,
  CreateManyParams,
  CreateManyResponse,
  CreateParams,
  CreateResponse,
  DataProvider,
  DeleteManyParams,
  DeleteManyResponse,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateManyParams,
  UpdateManyResponse,
  UpdateParams,
  UpdateResponse,
} from '@refinedev/core';
import type { TransactionContext } from '../features/transactions/manager';
import type {
  AggregateParams,
  AggregateResponse,
} from '../features/aggregations/executor';

/**
 * DataProvider with transaction support
 */
export interface DataProviderWithTransactions extends DataProvider {
  /**
   * Execute operations in a transaction
   *
   * @example
   * ```typescript
   * await dataProvider.transaction(async (tx) => {
   *   await tx.create({ resource: 'users', variables: { ... } });
   *   await tx.create({ resource: 'posts', variables: { userId: user.data.id } });
   * });
   * ```
   */
  transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>,
  ): Promise<T>;
}

/**
 * DataProvider with aggregation support
 */
export interface DataProviderWithAggregations extends DataProvider {
  /**
   * Execute aggregation query
   *
   * @example
   * ```typescript
   * const result = await dataProvider.aggregate({
   *   resource: 'orders',
   *   functions: [
   *     { type: 'count', alias: 'total' },
   *     { type: 'sum', field: 'amount', alias: 'revenue' }
   *   ],
   *   groupBy: ['status']
   * });
   * ```
   */
  aggregate<T extends BaseRecord = BaseRecord>(
    params: AggregateParams,
  ): Promise<AggregateResponse<T>>;
}

/**
 * Extended DataProvider interface with all possible features
 */
export interface ExtendedDataProvider
  extends DataProvider,
    DataProviderWithTransactions,
    DataProviderWithAggregations {}

/**
 * Type-safe DataProvider return type based on feature configuration
 *
 * Note: Simplified for practical use. Runtime methods are added dynamically.
 */
export type DataProviderWithFeatures = DataProvider &
  Partial<DataProviderWithTransactions> &
  Partial<DataProviderWithAggregations>;

/**
 * Type-safe aggregate function parameters
 */
export interface TypedAggregateParams<
  TResource extends string,
  TFunctions extends Array<any>,
> {
  resource: TResource;
  functions: TFunctions;
  filters?: any[];
  groupBy?: string[];
  having?: any[];
}

/**
 * Type-safe transaction callback
 */
export interface TypedTransactionCallback<T> {
  (tx: TransactionContext): Promise<T>;
}
