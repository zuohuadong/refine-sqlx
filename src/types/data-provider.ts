/**
 * Framework-agnostic DataProvider types for refine-sqlx
 *
 * These types are structurally compatible with both @refinedev/core and @svadmin/core,
 * allowing refine-sqlx to be used with any framework that implements the same DataProvider pattern.
 */

// ─── Base Types ────────────────────────────────────────────────

export type BaseRecord = Record<string, unknown>;

export type BaseKey = string | number;

// ─── Pagination ────────────────────────────────────────────────

export interface Pagination {
  current?: number;
  currentPage?: number;
  pageSize?: number;
  mode?: 'off' | 'server' | 'client';
}

// ─── Sorting ───────────────────────────────────────────────────

export interface CrudSort {
  field: string;
  order: 'asc' | 'desc';
}

export type CrudSorting = CrudSort[];

// ─── Filtering ─────────────────────────────────────────────────

export type CrudOperators =
  | 'eq' | 'ne' | 'lt' | 'gt' | 'lte' | 'gte'
  | 'in' | 'nin'
  | 'contains' | 'ncontains'
  | 'containss' | 'ncontainss'
  | 'startswith' | 'nstartswith'
  | 'endswith' | 'nendswith'
  | 'null' | 'nnull'
  | 'between' | 'nbetween'
  | 'or' | 'and';

export interface LogicalFilter {
  field: string;
  operator: Exclude<CrudOperators, 'or' | 'and'>;
  value: unknown;
}

export interface ConditionalFilter {
  operator: 'or' | 'and';
  value: (LogicalFilter | ConditionalFilter)[];
}

export type CrudFilter = LogicalFilter | ConditionalFilter;

export type CrudFilters = CrudFilter[];

// ─── Meta ──────────────────────────────────────────────────────

export type MetaQuery = Record<string, unknown>;

// ─── GetList ───────────────────────────────────────────────────

export interface GetListParams {
  resource: string;
  pagination?: Pagination;
  sorters?: CrudSorting;
  filters?: CrudFilters;
  meta?: MetaQuery;
}

export interface GetListResponse<TData extends BaseRecord = BaseRecord> {
  data: TData[];
  total: number;
}

// ─── GetOne ────────────────────────────────────────────────────

export interface GetOneParams {
  resource: string;
  id: BaseKey;
  meta?: MetaQuery;
}

export interface GetOneResponse<TData extends BaseRecord = BaseRecord> {
  data: TData;
}

// ─── GetMany ───────────────────────────────────────────────────

export interface GetManyParams {
  resource: string;
  ids: BaseKey[];
  meta?: MetaQuery;
}

export interface GetManyResponse<TData extends BaseRecord = BaseRecord> {
  data: TData[];
}

// ─── Create ────────────────────────────────────────────────────

export interface CreateParams<TVariables = {}> {
  resource: string;
  variables: TVariables;
  meta?: MetaQuery;
}

export interface CreateResponse<TData extends BaseRecord = BaseRecord> {
  data: TData;
}

// ─── CreateMany ────────────────────────────────────────────────

export interface CreateManyParams<TVariables = {}> {
  resource: string;
  variables: TVariables[];
  meta?: MetaQuery;
}

export interface CreateManyResponse<TData extends BaseRecord = BaseRecord> {
  data: TData[];
}

// ─── Update ────────────────────────────────────────────────────

export interface UpdateParams<TVariables = {}> {
  resource: string;
  id: BaseKey;
  variables: TVariables;
  meta?: MetaQuery;
}

export interface UpdateResponse<TData extends BaseRecord = BaseRecord> {
  data: TData;
}

// ─── UpdateMany ────────────────────────────────────────────────

export interface UpdateManyParams<TVariables = {}> {
  resource: string;
  ids: BaseKey[];
  variables: TVariables;
  meta?: MetaQuery;
}

export interface UpdateManyResponse<TData extends BaseRecord = BaseRecord> {
  data: TData[];
}

// ─── Delete ────────────────────────────────────────────────────

export interface DeleteOneParams<TVariables = {}> {
  resource: string;
  id: BaseKey;
  variables?: TVariables;
  meta?: MetaQuery;
}

export interface DeleteOneResponse<TData extends BaseRecord = BaseRecord> {
  data: TData;
}

// ─── DeleteMany ────────────────────────────────────────────────

export interface DeleteManyParams<TVariables = {}> {
  resource: string;
  ids: BaseKey[];
  variables?: TVariables;
  meta?: MetaQuery;
}

export interface DeleteManyResponse<TData extends BaseRecord = BaseRecord> {
  data: TData[];
}

// ─── Custom ────────────────────────────────────────────────────

export interface CustomParams<TQuery = unknown, TPayload = unknown> {
  url: string;
  method: 'get' | 'delete' | 'head' | 'options' | 'post' | 'put' | 'patch';
  payload?: TPayload;
  query?: TQuery;
  headers?: Record<string, string>;
  sorters?: CrudSorting;
  filters?: CrudFilters;
  meta?: MetaQuery;
}

export interface CustomResponse<TData = unknown> {
  data: TData;
}

// ─── DataProvider ──────────────────────────────────────────────

export interface DataProvider {
  getList: <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ) => Promise<GetListResponse<TData>>;

  getOne: <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ) => Promise<GetOneResponse<TData>>;

  getMany?: <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ) => Promise<GetManyResponse<TData>>;

  create: <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: CreateParams<TVariables>,
  ) => Promise<CreateResponse<TData>>;

  createMany?: <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: CreateManyParams<TVariables>,
  ) => Promise<CreateManyResponse<TData>>;

  update: <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: UpdateParams<TVariables>,
  ) => Promise<UpdateResponse<TData>>;

  updateMany?: <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: UpdateManyParams<TVariables>,
  ) => Promise<UpdateManyResponse<TData>>;

  deleteOne: <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteOneParams<TVariables>,
  ) => Promise<DeleteOneResponse<TData>>;

  deleteMany?: <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteManyParams<TVariables>,
  ) => Promise<DeleteManyResponse<TData>>;

  custom?: <TData extends BaseRecord = BaseRecord>(
    params: CustomParams,
  ) => Promise<CustomResponse<TData>>;

  getApiUrl: () => string;
}
