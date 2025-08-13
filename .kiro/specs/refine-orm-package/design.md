# Design Document

## Overview

本项目将构建两个独立的 npm 包，为 Refine 框架提供数据库支持：

1. **refine-orm** - 基于 drizzle-orm 的多数据库 ORM 适配器，支持 PostgreSQL、MySQL 和 SQLite
2. **refine-sqlx** - 轻量级 SQLite 专用适配器，基于原生 SQL 查询

项目采用 monorepo 结构，并实现自动化的 CI/CD 流程。

**作为 npm 库的核心特性：**

- 用户通过 `npm install refine-orm` 或 `npm install refine-sqlx` 安装
- 提供开箱即用的 TypeScript 类型支持
- 零配置的数据库适配器，自动检测运行时环境
- 完整的 ESM/CJS 双模块支持
- 详细的 API 文档和使用示例

### 核心设计原则

1. **开发者体验优先** - 提供简单易用的 API，最小化配置需求
2. **类型安全优先** - 利用 drizzle-orm 的类型推断能力提供完整的 TypeScript 支持
3. **运行时适配** - 自动检测 Bun/Node.js 环境，选择最优数据库驱动
4. **零依赖冲突** - 合理的 peer dependencies 设计，避免版本冲突
5. **渐进式增强** - 支持从简单 CRUD 到复杂查询的渐进式使用
6. **生产就绪** - 内置连接池、错误处理、日志记录等生产环境必需功能

## Architecture

### NPM 包发布结构

作为 npm 库，项目将发布两个独立的包：

1. **refine-orm** - 多数据库 ORM 适配器（新包）
2. **refine-sqlx** - SQLite 专用适配器（现有包升级）

### Monorepo 开发结构

```
project-root/
├── packages/
│   ├── refine-sqlx/           # 现有 SQLite 适配器 (迁移后)
│   │   ├── src/
│   │   ├── dist/              # 构建输出 (ESM + CJS)
│   │   ├── package.json       # 包含 exports, types, peerDependencies
│   │   ├── README.md          # 用户文档和安装指南
│   │   └── CHANGELOG.md       # 版本更新日志
│   └── refine-orm/            # 发布为 refine-orm
│       ├── src/
│       │   ├── adapters/      # 数据库适配器
│       │   ├── core/          # 核心功能
│       │   ├── types/         # 类型定义
│       │   ├── utils/         # 工具函数
│       │   └── index.ts       # 主入口文件
│       ├── dist/              # 构建输出 (ESM + CJS)
│       ├── package.json       # npm 包配置
│       ├── README.md          # 用户文档
│       └── CHANGELOG.md       # 版本更新日志
├── .github/
│   └── workflows/
│       ├── ci.yml             # 持续集成和测试
│       ├── release.yml        # 自动发布到 npm
│       └── docs.yml           # 文档部署
├── docs/                      # 用户文档网站
├── examples/                  # 使用示例
├── package.json               # 根 package.json (Bun workspace 配置)
└── bunfig.toml                # Bun 配置文件
```

### NPM 包设计规范

#### 包配置 (package.json)

```json
{
  "name": "refine-orm",
  "version": "1.0.0",
  "description": "Multi-database ORM data provider for Refine with Drizzle ORM",
  "keywords": [
    "refine",
    "orm",
    "drizzle",
    "postgresql",
    "mysql",
    "sqlite",
    "data-provider"
  ],
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./adapters/*": {
      "import": "./dist/adapters/*.mjs",
      "require": "./dist/adapters/*.js",
      "types": "./dist/adapters/*.d.ts"
    }
  },
  "files": ["dist", "README.md", "CHANGELOG.md"],
  "peerDependencies": { "@refinedev/core": "^4.0.0", "drizzle-orm": "^0.30.0" },
  "peerDependenciesMeta": {
    "postgres": { "optional": true },
    "mysql2": { "optional": true },
    "better-sqlite3": { "optional": true }
  }
}
```

#### 用户安装和使用流程

```bash
# 1. 安装核心包
npm install refine-orm drizzle-orm

# 2. 根据数据库类型安装驱动（按需安装）
npm install postgres          # PostgreSQL
npm install mysql2            # MySQL
npm install better-sqlite3    # SQLite (Node.js)

# 3. 安装 Drizzle 数据库适配器
npm install drizzle-orm/postgres-js    # PostgreSQL
npm install drizzle-orm/mysql2         # MySQL
npm install drizzle-orm/better-sqlite3 # SQLite
```

#### 零配置使用示例

```typescript
// 1. 定义数据库 Schema
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users };

// 2. 创建数据提供者 - 零配置
import { createPostgreSQLProvider } from 'refine-orm';

const dataProvider = createPostgreSQLProvider(
  process.env.DATABASE_URL!, // 连接字符串
  schema // Drizzle schema
);

// 3. 在 Refine 中使用
import { Refine } from '@refinedev/core';

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        {
          name: 'users',
          list: '/users',
          create: '/users/create',
          edit: '/users/edit/:id',
        },
      ]}
    />
  );
}
```

#### 高级配置示例

```typescript
// 自定义配置
const dataProvider = createPostgreSQLProvider(
  process.env.DATABASE_URL!,
  schema,
  {
    // 连接池配置
    pool: { min: 2, max: 10, acquireTimeoutMillis: 30000 },
    // 日志配置
    logger: true, // 或自定义日志函数
    // 调试模式
    debug: process.env.NODE_ENV === 'development',
  }
);

// 链式查询使用
const users = await dataProvider
  .from('users')
  .where('age', 'gte', 18)
  .where('status', 'eq', 'active')
  .orderBy('createdAt', 'desc')
  .paginate(1, 10)
  .get();

// 事务使用
await dataProvider.transaction(async tx => {
  const user = await tx.create('users', {
    name: 'John',
    email: 'john@example.com',
  });
  await tx.create('posts', { title: 'Hello', userId: user.data.id });
});
```

### 核心架构层次

```mermaid
graph TB
    A[Refine Application] --> B[refine-orm DataProvider]
    B --> C[Database Adapter Layer]
    C --> D[Drizzle ORM Layer]
    D --> E[Database Drivers]

    C --> F[PostgreSQL Adapter]
    C --> G[MySQL Adapter]
    C --> H[SQLite Adapter]

    F --> I[node-postgres]
    G --> J[mysql2]
    H --> K[better-sqlite3/bun:sqlite]

    B --> L[Query Builder]
    B --> M[Type System]
    B --> N[Transaction Manager]
    B --> O[Connection Pool]
```

## Components and Interfaces

### 1. 核心接口定义

```typescript
// packages/refine-orm/src/types/client.ts
export interface RefineOrmDataProvider<TSchema extends Record<string, Table>> {
  client: DrizzleClient<TSchema>;
  schema: TSchema;

  // 传统的 CRUD 操作（保持 Refine 兼容性）
  getList<TTable extends keyof TSchema>(
    resource: TTable,
    params?: GetListParams
  ): Promise<GetListResponse<InferSelectModel<TSchema[TTable]>>>;

  getOne<TTable extends keyof TSchema>(
    resource: TTable,
    id: any
  ): Promise<GetOneResponse<InferSelectModel<TSchema[TTable]>>>;

  create<TTable extends keyof TSchema>(
    resource: TTable,
    data: InferInsertModel<TSchema[TTable]>
  ): Promise<CreateResponse<InferSelectModel<TSchema[TTable]>>>;

  update<TTable extends keyof TSchema>(
    resource: TTable,
    id: any,
    data: Partial<InferInsertModel<TSchema[TTable]>>
  ): Promise<UpdateResponse<InferSelectModel<TSchema[TTable]>>>;

  delete<TTable extends keyof TSchema>(
    resource: TTable,
    id: any
  ): Promise<DeleteOneResponse<InferSelectModel<TSchema[TTable]>>>;

  // 批量操作
  createMany<TTable extends keyof TSchema>(
    resource: TTable,
    data: InferInsertModel<TSchema[TTable]>[]
  ): Promise<CreateManyResponse<InferSelectModel<TSchema[TTable]>>>;

  updateMany<TTable extends keyof TSchema>(
    resource: TTable,
    ids: any[],
    data: Partial<InferInsertModel<TSchema[TTable]>>
  ): Promise<UpdateManyResponse<InferSelectModel<TSchema[TTable]>>>;

  deleteMany<TTable extends keyof TSchema>(
    resource: TTable,
    ids: any[]
  ): Promise<DeleteManyResponse<InferSelectModel<TSchema[TTable]>>>;

  // 链式查询 API
  from<TTable extends keyof TSchema>(
    resource: TTable
  ): ChainQuery<TSchema, TTable>;

  // 多态关联查询
  morphTo<TTable extends keyof TSchema>(
    resource: TTable,
    morphConfig: MorphConfig<TSchema>
  ): MorphQuery<TSchema, TTable>;

  // 原生查询构建器
  query: {
    select<TTable extends keyof TSchema>(
      resource: TTable
    ): SelectChain<TSchema, TTable>;
    insert<TTable extends keyof TSchema>(
      resource: TTable
    ): InsertChain<TSchema, TTable>;
    update<TTable extends keyof TSchema>(
      resource: TTable
    ): UpdateChain<TSchema, TTable>;
    delete<TTable extends keyof TSchema>(
      resource: TTable
    ): DeleteChain<TSchema, TTable>;
  };

  // 关系查询
  getWithRelations<TTable extends keyof TSchema>(
    resource: TTable,
    id: any,
    relations?: (keyof TSchema)[]
  ): Promise<GetOneResponse<InferSelectModel<TSchema[TTable]>>>;

  // 原生查询支持
  executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]>;

  // 事务支持
  transaction<T>(
    fn: (tx: RefineOrmDataProvider<TSchema>) => Promise<T>
  ): Promise<T>;
}

// 链式查询相关类型
export interface ChainQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;

  with<TRelation extends keyof TSchema>(
    relation: TRelation,
    callback?: (
      query: ChainQuery<TSchema, TRelation>
    ) => ChainQuery<TSchema, TRelation>
  ): this;

  morphTo(morphField: string, morphTypes: Record<string, keyof TSchema>): this;

  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    direction?: 'asc' | 'desc'
  ): this;

  limit(count: number): this;
  offset(count: number): this;
  paginate(page: number, pageSize?: number): this;

  // 执行方法
  get(): Promise<InferSelectModel<TSchema[TTable]>[]>;
  first(): Promise<InferSelectModel<TSchema[TTable]> | null>;
  count(): Promise<number>;
  sum<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number>;
  avg<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number>;
}

// 多态关联配置
export interface MorphConfig<TSchema extends Record<string, Table>> {
  typeField: string;
  idField: string;
  relationName: string;
  types: Record<string, keyof TSchema>;
}

// 多态查询结果
export type MorphResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> = InferSelectModel<TSchema[TTable]> & { [K in string]: any };

// 过滤器操作符
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'like'
  | 'ilike'
  | 'notLike'
  | 'isNull'
  | 'isNotNull'
  | 'between'
  | 'notBetween';

// 链式查询构建器类型
export interface SelectChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends ChainQuery<TSchema, TTable> {
  select<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns: TColumns
  ): this;

  distinct(): this;
  groupBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): this;
  having(condition: any): this;
}

export interface InsertChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  values(data: InferInsertModel<TSchema[TTable]>): this;
  values(data: InferInsertModel<TSchema[TTable]>[]): this;
  onConflict(action: 'ignore' | 'update'): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

export interface UpdateChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  set(data: Partial<InferInsertModel<TSchema[TTable]>>): this;
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

export interface DeleteChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

export interface RefineOrmOptions {
  logger?: boolean | ((query: string, params: any[]) => void);
  debug?: boolean;
  pool?: { min?: number; max?: number; acquireTimeoutMillis?: number };
}
```

### 2. 数据库适配器层

```typescript
// packages/refine-orm/src/adapters/base.ts
export abstract class BaseDatabaseAdapter<TSchema = Record<string, unknown>> {
  protected client: DrizzleClient<TSchema>;
  protected config: DatabaseConfig;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;

  // CRUD 操作的抽象方法
  abstract executeQuery<T>(query: Query): Promise<T[]>;
  abstract executeInsert<T>(table: string, data: T): Promise<T>;
  abstract executeUpdate<T>(
    table: string,
    id: any,
    data: Partial<T>
  ): Promise<T>;
  abstract executeDelete(table: string, id: any): Promise<void>;
}

// packages/refine-orm/src/adapters/postgresql.ts
export class PostgreSQLAdapter<TSchema> extends BaseDatabaseAdapter<TSchema> {
  private connection: any;

  async connect() {
    // 运行时检测和适配器选择
    if (this.detectBunRuntime()) {
      // Bun 环境：使用 bun:sql
      const { sql } = await import('bun:sql');
      this.connection = sql(this.config.connection);
      this.client = drizzle(this.connection, {
        schema: this.config.schema,
        mode: 'bun-sql',
      });
    } else {
      // Node.js 环境：使用 postgres 驱动
      const postgres = await import('postgres');
      this.connection = postgres.default(this.config.connection);
      this.client = drizzle(this.connection, {
        schema: this.config.schema,
        mode: 'postgres-js',
      });
    }
  }

  private detectBunRuntime(): boolean {
    return typeof Bun !== 'undefined' && typeof Bun.sql === 'function';
  }

  // 实现具体的 PostgreSQL 操作
}

// packages/refine-orm/src/adapters/mysql.ts
export class MySQLAdapter<TSchema> extends BaseDatabaseAdapter<TSchema> {
  private connection: any;

  async connect() {
    // 运行时检测和适配器选择
    if (this.detectBunRuntime()) {
      // Bun 环境：由于 bun:sql 暂不支持 MySQL，使用 mysql2 驱动
      // 注意：未来 bun:sql 支持 MySQL 时可以切换
      const mysql = await import('mysql2/promise');
      this.connection = await mysql.createConnection(this.config.connection);
      this.client = drizzle(this.connection, {
        schema: this.config.schema,
        mode: 'mysql2',
      });
    } else {
      // Node.js 环境：使用 mysql2 驱动
      const mysql = await import('mysql2/promise');
      this.connection = await mysql.createConnection(this.config.connection);
      this.client = drizzle(this.connection, {
        schema: this.config.schema,
        mode: 'mysql2',
      });
    }
  }

  private detectBunRuntime(): boolean {
    return typeof Bun !== 'undefined';
  }

  // 检查 bun:sql MySQL 支持状态
  private async checkBunSqlMySQLSupport(): Promise<boolean> {
    try {
      if (typeof Bun !== 'undefined' && typeof Bun.sql === 'function') {
        // 尝试检测 MySQL 支持
        // 这里可以添加版本检查或功能检测逻辑
        return false; // 目前返回 false，等待官方支持
      }
      return false;
    } catch {
      return false;
    }
  }

  // 实现具体的 MySQL 操作
}

// packages/refine-orm/src/adapters/sqlite.ts
export class SQLiteAdapter<TSchema> extends BaseDatabaseAdapter<TSchema> {
  private db: any;

  async connect() {
    // 运行时检测和适配器选择
    if (this.detectBunRuntime()) {
      // Bun 环境：使用 bun:sqlite
      const { Database } = await import('bun:sqlite');
      this.db = new Database(this.config.connection);
      this.client = drizzle(this.db, {
        schema: this.config.schema,
        mode: 'bun-sqlite',
      });
    } else {
      // Node.js 环境：使用 better-sqlite3
      const Database = await import('better-sqlite3');
      this.db = new Database.default(this.config.connection);
      this.client = drizzle(this.db, {
        schema: this.config.schema,
        mode: 'better-sqlite3',
      });
    }
  }

  private detectBunRuntime(): boolean {
    return typeof Bun !== 'undefined' && typeof Bun.sqlite === 'function';
  }

  // 实现具体的 SQLite 操作
}
```

### 3. 查询构建器

```typescript
// packages/refine-orm/src/core/query-builder.ts
export class RefineQueryBuilder<TSchema> {
  constructor(private client: DrizzleClient<TSchema>) {}

  buildListQuery(params: GetListParams): DrizzleQuery {
    let query = this.client.select();

    // 应用过滤器
    if (params.filters) {
      query = this.applyFilters(query, params.filters);
    }

    // 应用排序
    if (params.sorters) {
      query = this.applySorting(query, params.sorters);
    }

    // 应用分页
    if (params.pagination) {
      query = this.applyPagination(query, params.pagination);
    }

    return query;
  }

  private applyFilters(
    query: DrizzleQuery,
    filters: CrudFilters
  ): DrizzleQuery {
    // 实现过滤器逻辑，支持所有 Refine 过滤器操作符
  }

  private applySorting(
    query: DrizzleQuery,
    sorters: CrudSorting
  ): DrizzleQuery {
    // 实现排序逻辑
  }

  private applyPagination(
    query: DrizzleQuery,
    pagination: Pagination
  ): DrizzleQuery {
    // 实现分页逻辑
  }
}
```

### 4. 类型系统

```typescript
// packages/refine-orm/src/types/schema.ts
export type InferSelectModel<T> = T extends Table ? InferSelectModel<T> : never;
export type InferInsertModel<T> = T extends Table ? InferInsertModel<T> : never;

export type SchemaConfig<TSchema> = {
  [K in keyof TSchema]: TSchema[K] extends Table ? TSchema[K] : never;
};

// packages/refine-orm/src/types/operations.ts
export interface TypedCreateParams<TSchema, TTable extends keyof TSchema>
  extends Omit<CreateParams, 'variables'> {
  resource: TTable;
  variables: InferInsertModel<TSchema[TTable]>;
}

export interface TypedUpdateParams<TSchema, TTable extends keyof TSchema>
  extends Omit<UpdateParams, 'variables'> {
  resource: TTable;
  variables: Partial<InferInsertModel<TSchema[TTable]>>;
}

export interface TypedGetOneResponse<TSchema, TTable extends keyof TSchema>
  extends Omit<GetOneResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>;
}
```

### 5. 主要工厂函数

```typescript
// packages/refine-orm/src/index.ts
export function createRefine<TSchema extends Record<string, Table>>(
  client: DrizzleClient<TSchema>,
  options?: RefineOrmOptions
): RefineOrmDataProvider<TSchema> {
  const queryBuilder = new RefineQueryBuilder(client);
  const typeHelper = new TypeHelper<TSchema>();
  const chainBuilder = new ChainQueryBuilder(client);

  return {
    client,
    schema: client.schema,

    // 传统的 CRUD 方法（保持兼容性）
    async getList<TTable extends keyof TSchema>(
      resource: TTable,
      params?: GetListParams
    ): Promise<GetListResponse<InferSelectModel<TSchema[TTable]>>> {
      const table = client.schema[resource];
      const query = queryBuilder.buildSelectQuery(table, params);
      const data = await query.execute();
      const total = await queryBuilder
        .buildCountQuery(table, params?.filters)
        .execute();

      return { data, total: total[0].count };
    },

    // 链式调用 API
    from<TTable extends keyof TSchema>(
      resource: TTable
    ): ChainQuery<TSchema, TTable> {
      return chainBuilder.from(resource);
    },

    // 多态关联查询
    morphTo<TTable extends keyof TSchema>(
      resource: TTable,
      morphConfig: MorphConfig<TSchema>
    ): MorphQuery<TSchema, TTable> {
      return new MorphQuery(client, resource, morphConfig);
    },

    // 原生查询构建器
    query: {
      select: <TTable extends keyof TSchema>(resource: TTable) =>
        chainBuilder.select(resource),
      insert: <TTable extends keyof TSchema>(resource: TTable) =>
        chainBuilder.insert(resource),
      update: <TTable extends keyof TSchema>(resource: TTable) =>
        chainBuilder.update(resource),
      delete: <TTable extends keyof TSchema>(resource: TTable) =>
        chainBuilder.delete(resource),
    },

    // 传统方法保持不变...
    async create<TTable extends keyof TSchema>(
      resource: TTable,
      data: InferInsertModel<TSchema[TTable]>
    ): Promise<CreateResponse<InferSelectModel<TSchema[TTable]>>> {
      const table = client.schema[resource];
      const [result] = await client.insert(table).values(data).returning();

      return { data: result };
    },
  };
}

// 链式查询构建器
export class ChainQueryBuilder<TSchema extends Record<string, Table>> {
  constructor(private client: DrizzleClient<TSchema>) {}

  from<TTable extends keyof TSchema>(
    resource: TTable
  ): ChainQuery<TSchema, TTable> {
    return new ChainQuery(this.client, resource);
  }

  select<TTable extends keyof TSchema>(
    resource: TTable
  ): SelectChain<TSchema, TTable> {
    return new SelectChain(this.client, resource);
  }

  insert<TTable extends keyof TSchema>(
    resource: TTable
  ): InsertChain<TSchema, TTable> {
    return new InsertChain(this.client, resource);
  }

  update<TTable extends keyof TSchema>(
    resource: TTable
  ): UpdateChain<TSchema, TTable> {
    return new UpdateChain(this.client, resource);
  }

  delete<TTable extends keyof TSchema>(
    resource: TTable
  ): DeleteChain<TSchema, TTable> {
    return new DeleteChain(this.client, resource);
  }
}

// 链式查询类
export class ChainQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  private query: any;
  private table: TSchema[TTable];

  constructor(
    private client: DrizzleClient<TSchema>,
    private resource: TTable
  ) {
    this.table = client.schema[resource];
    this.query = client.select().from(this.table);
  }

  // 条件筛选
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this {
    const condition = this.buildCondition(column, operator, value);
    this.query = this.query.where(condition);
    return this;
  }

  // 关联查询
  with<TRelation extends keyof TSchema>(
    relation: TRelation,
    callback?: (
      query: ChainQuery<TSchema, TRelation>
    ) => ChainQuery<TSchema, TRelation>
  ): this {
    const relationQuery = new ChainQuery(this.client, relation);
    if (callback) {
      callback(relationQuery);
    }
    // 实现关联逻辑
    return this;
  }

  // 多态关联
  morphTo(morphField: string, morphTypes: Record<string, keyof TSchema>): this {
    // 实现多态关联逻辑
    return this;
  }

  // 排序
  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    direction: 'asc' | 'desc' = 'asc'
  ): this {
    this.query = this.query.orderBy(
      direction === 'asc' ? asc(this.table[column]) : desc(this.table[column])
    );
    return this;
  }

  // 分页
  limit(count: number): this {
    this.query = this.query.limit(count);
    return this;
  }

  offset(count: number): this {
    this.query = this.query.offset(count);
    return this;
  }

  // 分页便捷方法
  paginate(page: number, pageSize: number = 10): this {
    return this.limit(pageSize).offset((page - 1) * pageSize);
  }

  // 执行查询
  async get(): Promise<InferSelectModel<TSchema[TTable]>[]> {
    return await this.query.execute();
  }

  async first(): Promise<InferSelectModel<TSchema[TTable]> | null> {
    const results = await this.limit(1).get();
    return results[0] || null;
  }

  async count(): Promise<number> {
    const countQuery = this.client
      .select({ count: sql`count(*)` })
      .from(this.table);
    const [result] = await countQuery.execute();
    return result.count;
  }

  // 聚合函数
  async sum<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number> {
    const sumQuery = this.client
      .select({ sum: sql`sum(${this.table[column]})` })
      .from(this.table);
    const [result] = await sumQuery.execute();
    return result.sum || 0;
  }

  async avg<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number> {
    const avgQuery = this.client
      .select({ avg: sql`avg(${this.table[column]})` })
      .from(this.table);
    const [result] = await avgQuery.execute();
    return result.avg || 0;
  }

  private buildCondition(column: any, operator: FilterOperator, value: any) {
    const col = this.table[column];
    switch (operator) {
      case 'eq':
        return eq(col, value);
      case 'ne':
        return ne(col, value);
      case 'gt':
        return gt(col, value);
      case 'gte':
        return gte(col, value);
      case 'lt':
        return lt(col, value);
      case 'lte':
        return lte(col, value);
      case 'in':
        return inArray(col, value);
      case 'like':
        return like(col, `%${value}%`);
      case 'ilike':
        return ilike(col, `%${value}%`);
      case 'isNull':
        return isNull(col);
      case 'isNotNull':
        return isNotNull(col);
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}

// 多态关联查询类
export class MorphQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  constructor(
    private client: DrizzleClient<TSchema>,
    private resource: TTable,
    private morphConfig: MorphConfig<TSchema>
  ) {}

  async get(): Promise<MorphResult<TSchema, TTable>[]> {
    const baseQuery = this.client
      .select()
      .from(this.client.schema[this.resource]);
    const results = await baseQuery.execute();

    // 根据多态字段加载相关数据
    const morphResults = await Promise.all(
      results.map(async item => {
        const morphType = item[this.morphConfig.typeField];
        const morphId = item[this.morphConfig.idField];

        if (morphType && morphId && this.morphConfig.types[morphType]) {
          const relatedTable = this.morphConfig.types[morphType];
          const relatedQuery = this.client
            .select()
            .from(this.client.schema[relatedTable])
            .where(eq(this.client.schema[relatedTable].id, morphId));

          const [relatedData] = await relatedQuery.execute();

          return { ...item, [this.morphConfig.relationName]: relatedData };
        }

        return item;
      })
    );

    return morphResults;
  }
}

// 使用示例
const orm = createRefine(client, schema);

// 链式调用示例
const users = await orm
  .from('users')
  .where('age', 'gte', 18)
  .where('status', 'eq', 'active')
  .with('posts', query =>
    query.where('published', 'eq', true).orderBy('createdAt', 'desc')
  )
  .orderBy('name')
  .paginate(1, 10)
  .get();

// 多态关联示例
const comments = await orm
  .morphTo('comments', {
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .get();

// 原生查询构建器
const complexQuery = await orm.query
  .select('users')
  .where('age', 'between', [18, 65])
  .with('posts')
  .orderBy('createdAt', 'desc')
  .limit(50)
  .get();
```

// 便捷的数据库特定工厂函数
export function createPostgreSQLProvider<TSchema extends Record<string, Table>>(
connectionString: string,
schema: TSchema,
options?: PostgreSQLOptions
): RefineOrmDataProvider<TSchema> {
// 运行时检测
if (detectBunRuntime()) {
// Bun 环境使用 bun:sql
const { sql } = require('bun:sql');
const client = drizzle(sql(connectionString), { schema });
return createRefine(client, options);
} else {
// Node.js 环境使用 postgres
const postgres = require('postgres');
const client = drizzle(postgres(connectionString), { schema });
return createRefine(client, options);
}
}

export function createMySQLProvider<TSchema extends Record<string, Table>>(
connectionString: string,
schema: TSchema,
options?: MySQLOptions
): RefineOrmDataProvider<TSchema> {
// MySQL 在所有环境下都使用 mysql2 驱动
// 原因：bun:sql 暂不支持 MySQL
const mysql = require('mysql2/promise');
const connection = mysql.createConnection(connectionString);
const client = drizzle(connection, { schema });
return createRefine(client, options);
}

export function createSQLiteProvider<TSchema extends Record<string, Table>>(
database: string | Database,
schema: TSchema,
options?: SQLiteOptions
): RefineOrmDataProvider<TSchema> {
// 运行时检测
if (detectBunRuntime()) {
// Bun 环境使用 bun:sqlite
const { Database } = require('bun:sqlite');
const db = typeof database === 'string' ? new Database(database) : database;
const client = drizzle(db, { schema });
return createRefine(client, options);
} else {
// Node.js 环境使用 better-sqlite3
const Database = require('better-sqlite3');
const db = typeof database === 'string' ? new Database(database) : database;
const client = drizzle(db, { schema });
return createRefine(client, options);
}
}

// 运行时检测工具函数
function detectBunRuntime(): boolean {
return typeof Bun !== 'undefined';
}

function detectBunSqlSupport(dbType: 'postgresql' | 'mysql' | 'sqlite'): boolean {
if (!detectBunRuntime() || typeof Bun.sql !== 'function') {
return false;
}

switch (dbType) {
case 'postgresql':
return true; // bun:sql 支持 PostgreSQL
case 'mysql':
return false; // bun:sql 暂不支持 MySQL
case 'sqlite':
return typeof Bun.sqlite === 'function'; // 检查 bun:sqlite 支持
default:
return false;
}
}

````

## Data Models

### 1. 配置模型

```typescript
export interface ConnectionOptions {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | SSLConfig;
}

export interface PoolConfig {
  min?: number;
  max?: number;
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;
}

export interface SSLConfig {
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}
````

### 2. 查询模型

```typescript
export interface QueryContext {
  resource: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  filters?: CrudFilters;
  sorters?: CrudSorting;
  pagination?: Pagination;
  meta?: Record<string, any>;
}

export interface QueryResult<T = any> {
  data: T[];
  total?: number;
  meta?: Record<string, any>;
}
```

### 3. 事务模型

```typescript
export interface TransactionContext<TSchema> {
  client: DrizzleClient<TSchema>;
  operations: TransactionOperation[];
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
}

export interface TransactionOperation {
  type: 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  where?: any;
}
```

## Error Handling

### 1. 错误类型定义

```typescript
// packages/refine-orm/src/types/errors.ts
export abstract class RefineOrmError extends Error {
  abstract code: string;
  abstract statusCode: number;

  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConnectionError extends RefineOrmError {
  code = 'CONNECTION_ERROR';
  statusCode = 500;
}

export class QueryError extends RefineOrmError {
  code = 'QUERY_ERROR';
  statusCode = 400;

  constructor(
    message: string,
    public query?: string,
    cause?: Error
  ) {
    super(message, cause);
  }
}

export class ValidationError extends RefineOrmError {
  code = 'VALIDATION_ERROR';
  statusCode = 422;

  constructor(
    message: string,
    public field?: string,
    cause?: Error
  ) {
    super(message, cause);
  }
}

export class TransactionError extends RefineOrmError {
  code = 'TRANSACTION_ERROR';
  statusCode = 500;
}
```

### 2. 错误处理中间件

```typescript
// packages/refine-orm/src/core/error-handler.ts
export class ErrorHandler {
  static handle(error: unknown): RefineOrmError {
    if (error instanceof RefineOrmError) {
      return error;
    }

    if (error instanceof Error) {
      // 根据错误类型和消息转换为相应的 RefineOrmError
      if (error.message.includes('connection')) {
        return new ConnectionError(error.message, error);
      }

      if (error.message.includes('syntax')) {
        return new QueryError(error.message, undefined, error);
      }

      return new RefineOrmError(error.message, error);
    }

    return new RefineOrmError('Unknown error occurred');
  }

  static async withErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw ErrorHandler.handle(error);
    }
  }
}
```

## Testing Strategy

### 1. 测试架构

```typescript
// packages/refine-orm/src/__tests__/setup.ts
export interface TestDatabaseConfig {
  postgresql: { container: TestContainer; config: DatabaseConfig };
  mysql: { container: TestContainer; config: DatabaseConfig };
  sqlite: { config: DatabaseConfig };
}

export class TestEnvironment {
  private containers: Map<string, TestContainer> = new Map();

  async setup(): Promise<TestDatabaseConfig> {
    // 启动测试数据库容器
    const pgContainer = await this.startPostgreSQLContainer();
    const mysqlContainer = await this.startMySQLContainer();

    return {
      postgresql: {
        container: pgContainer,
        config: this.createPostgreSQLConfig(pgContainer),
      },
      mysql: {
        container: mysqlContainer,
        config: this.createMySQLConfig(mysqlContainer),
      },
      sqlite: { config: { type: 'sqlite', connection: ':memory:' } },
    };
  }

  async teardown(): Promise<void> {
    // 清理测试容器
    for (const container of this.containers.values()) {
      await container.stop();
    }
  }
}
```

### 2. 测试用例结构

```typescript
// packages/refine-orm/src/__tests__/integration/crud.test.ts
describe('CRUD Operations', () => {
  let testEnv: TestEnvironment;
  let configs: TestDatabaseConfig;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    configs = await testEnv.setup();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe.each([
    ['PostgreSQL', () => configs.postgresql.config],
    ['MySQL', () => configs.mysql.config],
    ['SQLite', () => configs.sqlite.config],
  ])('%s Database', (dbName, getConfig) => {
    let dataProvider: RefineOrmDataProvider;

    beforeEach(async () => {
      const config = getConfig();
      dataProvider = createRefine(config, testSchema);
      await dataProvider.client.migrate();
    });

    test('should create record', async () => {
      const result = await dataProvider.create({
        resource: 'users',
        variables: { name: 'John Doe', email: 'john@example.com' },
      });

      expect(result.data).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    // 更多测试用例...
  });
});
```

### 3. 性能测试

```typescript
// packages/refine-orm/src/__tests__/performance/benchmark.test.ts
describe('Performance Benchmarks', () => {
  test('should handle 1000 concurrent queries', async () => {
    const promises = Array.from({ length: 1000 }, () =>
      dataProvider.getList('users', {
        pagination: { current: 1, pageSize: 10 },
      })
    );

    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // 5秒内完成
  });

  test('should optimize batch operations', async () => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }));

    const start = Date.now();
    await dataProvider.createMany('users', data);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // 1秒内完成批量插入
  });
});
```

## NPM 包发布和维护策略

### 1. 版本管理策略

```json
// 使用 Semantic Versioning
{
  "version": "1.0.0" // MAJOR.MINOR.PATCH
  // MAJOR: 破坏性变更
  // MINOR: 新功能，向后兼容
  // PATCH: 错误修复，向后兼容
}
```

#### 发布计划

- **Alpha 版本** (0.1.0-alpha.x): 核心功能开发阶段
- **Beta 版本** (0.1.0-beta.x): 功能完整，社区测试阶段
- **RC 版本** (1.0.0-rc.x): 发布候选版本，生产环境测试
- **正式版本** (1.0.0): 稳定版本，生产环境就绪

### 2. 包质量保证

#### 自动化检查

```yaml
# .github/workflows/quality.yml
name: Package Quality
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - name: Type Check
        run: bun run type-check
      - name: Lint
        run: bun run lint
      - name: Test Coverage
        run: bun run test:coverage
      - name: Bundle Size Check
        run: bun run bundle-size
      - name: Package Audit
        run: npm audit
```

#### 包大小优化

- Tree-shaking 支持
- 按需导入设计
- 外部依赖优化
- 构建产物压缩

### 3. 用户支持和文档

#### 文档结构

```
docs/
├── getting-started.md        # 快速开始
├── api-reference.md          # API 文档
├── database-guides/          # 数据库特定指南
│   ├── postgresql.md
│   ├── mysql.md
│   └── sqlite.md
├── migration-guides/         # 迁移指南
├── troubleshooting.md        # 故障排除
└── examples/                 # 使用示例
    ├── basic-crud/
    ├── advanced-queries/
    └── production-setup/
```

#### 社区支持

- GitHub Issues 模板
- Discord/Slack 社区频道
- 定期发布更新日志
- 用户反馈收集机制

### 4. 持续集成和部署

#### CI/CD 流程

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      - name: Install Dependencies
        run: bun install
      - name: Build Packages
        run: bun run build
      - name: Run Tests
        run: bun run test
      - name: Release
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: bun run release
```

#### 发布检查清单

- [ ] 所有测试通过
- [ ] 类型检查无错误
- [ ] 文档更新完成
- [ ] CHANGELOG 更新
- [ ] 版本号正确
- [ ] 构建产物验证
- [ ] npm pack 测试
- [ ] 发布说明准备

### 5. 监控和分析

#### 包使用统计

- npm 下载量监控
- GitHub Stars/Forks 跟踪
- 用户反馈分析
- 性能指标收集

#### 错误监控

```typescript
// 可选的错误报告集成
import { ErrorHandler } from 'refine-orm';

ErrorHandler.onError((error, context) => {
  // 发送到错误监控服务（如 Sentry）
  if (process.env.NODE_ENV === 'production') {
    console.error('RefineORM Error:', error, context);
  }
});
```

## 用户迁移和兼容性策略

### 1. 从现有数据提供者迁移

#### 从 @refinedev/simple-rest 迁移

```typescript
// 迁移前
import dataProvider from '@refinedev/simple-rest';

const dp = dataProvider('https://api.example.com');

// 迁移后
import { createPostgreSQLProvider } from 'refine-orm';

const dp = createPostgreSQLProvider(process.env.DATABASE_URL!, schema, {
  // 可选：添加 REST API 兼容层
  restApiCompat: true,
});
```

#### 从其他 ORM 迁移

```typescript
// 从 Prisma 迁移示例
// 1. 转换 Schema 定义
// Prisma schema.prisma -> Drizzle schema.ts

// 2. 更新数据提供者
// 迁移前 (Prisma)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 迁移后 (Drizzle + RefineORM)
import { createPostgreSQLProvider } from 'refine-orm';
const dataProvider = createPostgreSQLProvider(connectionString, schema);
```

### 2. 向后兼容性保证

#### API 稳定性承诺

- 主版本内保持 API 稳定
- 废弃功能提前 2 个小版本通知
- 提供自动化迁移工具

#### 类型兼容性

```typescript
// 确保类型定义向后兼容
export interface RefineOrmDataProvider<TSchema> extends DataProvider {
  // 扩展标准 DataProvider 接口
  // 不破坏现有类型定义
}
```

### 3. 渐进式采用策略

#### 混合使用支持

```typescript
// 允许在同一应用中混合使用不同数据提供者
import { Refine } from '@refinedev/core';
import { createPostgreSQLProvider } from 'refine-orm';
import simpleRestProvider from '@refinedev/simple-rest';

const postgresProvider = createPostgreSQLProvider(dbUrl, schema);
const restProvider = simpleRestProvider('https://api.example.com');

function App() {
  return (
    <Refine
      dataProvider={{
        default: postgresProvider,
        api: restProvider, // 某些资源使用 REST API
      }}
      resources={[
        { name: 'users', dataProviderName: 'default' },
        { name: 'external-data', dataProviderName: 'api' },
      ]}
    />
  );
}
```

#### 功能渐进启用

```typescript
// 用户可以逐步启用高级功能
const dataProvider = createPostgreSQLProvider(connectionString, schema, {
  // 基础配置
  enableChainQueries: false, // 默认关闭链式查询
  enableMorphQueries: false, // 默认关闭多态查询
  enableTransactions: true, // 默认启用事务

  // 用户可以按需启用
  features: {
    chainQueries: true, // 启用链式查询
    morphQueries: true, // 启用多态查询
    advancedFilters: true, // 启用高级过滤器
  },
});
```

### 4. 生态系统集成

#### 与 Refine 生态的深度集成

```typescript
// 与 @refinedev/devtools 集成
import { DevtoolsProvider } from '@refinedev/devtools';

function App() {
  return (
    <DevtoolsProvider>
      <Refine
        dataProvider={dataProvider}
        // RefineORM 自动提供调试信息给 devtools
      />
    </DevtoolsProvider>
  );
}

// 与 @refinedev/inferencer 集成
// 自动推断 CRUD 页面结构
import { PostgreSQLInferencer } from 'refine-orm/inferencer';

const UserList = () => <PostgreSQLInferencer resource="users" action="list" />;
```

#### 第三方工具集成

```typescript
// 与流行工具的集成示例
import { createPostgreSQLProvider } from 'refine-orm';

// 与 Zod 验证集成
import { z } from 'zod';
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const dataProvider = createPostgreSQLProvider(connectionString, schema, {
  validation: {
    users: userSchema, // 自动验证用户输入
  },
});

// 与缓存系统集成
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

const dataProvider = createPostgreSQLProvider(connectionString, schema, {
  cache: {
    provider: redis,
    ttl: 300, // 5分钟缓存
  },
});
```

```typescript
// packages/refine-orm/src/__tests__/performance/benchmark.test.ts
describe('Performance Benchmarks', () => {
  test('should handle large dataset efficiently', async () => {
    const startTime = performance.now();

    // 创建大量数据
    const data = Array.from({ length: 10000 }, (_, i) => ({
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }));

    await dataProvider.createMany({ resource: 'users', variables: data });

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000); // 应在 5 秒内完成
  });
});
```

## Refine-SQLx 轻量级设计和兼容性

### 1. 保持 refine-sqlx 轻量级

refine-sqlx 包将保持其轻量级特性，不依赖 refine-orm，确保包体积小且启动快速。

```typescript
// packages/refine-sqlx/src/index.ts - 保持原有轻量级设计
export type * from './client';
export { default as createRefineSQL } from './data-provider';

// 不引入任何 ORM 相关依赖
// 保持现有的适配器模式和 SQL 客户端接口
```

### 2. 可选的 ORM 兼容层

通过可选的扩展包或插件方式提供 ORM 功能，而不是直接集成到核心包中。

```typescript
// packages/refine-sqlx/src/extensions/orm-compat.ts - 可选扩展
export interface OrmCompatExtension<TSchema extends Record<string, Table>> {
  // 链式查询接口（轻量级实现）
  from<TTable extends keyof TSchema>(
    resource: TTable
  ): SqlxChainQuery<TSchema, TTable>;

  // 多态关联查询（基于现有 SQL 客户端）
  morphTo<TTable extends keyof TSchema>(
    resource: TTable,
    morphConfig: MorphConfig<TSchema>
  ): SqlxMorphQuery<TSchema, TTable>;
}

// 轻量级链式查询实现（不依赖 drizzle-orm）
export class SqlxChainQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  private conditions: string[] = [];
  private params: any[] = [];
  private orderClauses: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(
    private client: SqlClient,
    private tableName: string
  ) {}

  where(column: string, operator: string, value: any): this {
    const condition = this.buildCondition(column, operator, value);
    this.conditions.push(condition.sql);
    this.params.push(...condition.params);
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderClauses.push(`${column} ${direction.toUpperCase()}`);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  paginate(page: number, pageSize: number = 10): this {
    return this.limit(pageSize).offset((page - 1) * pageSize);
  }

  async get(): Promise<any[]> {
    const sql = this.buildSelectSQL();
    const result = await this.client.query({ sql, args: this.params });
    return deserializeSqlResult(result);
  }

  async first(): Promise<any | null> {
    const results = await this.limit(1).get();
    return results[0] || null;
  }

  async count(): Promise<number> {
    const sql = this.buildCountSQL();
    const result = await this.client.query({ sql, args: this.params });
    return result.rows[0][0] as number;
  }

  private buildSelectSQL(): string {
    let sql = `SELECT * FROM ${this.tableName}`;

    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`;
    }

    if (this.orderClauses.length > 0) {
      sql += ` ORDER BY ${this.orderClauses.join(', ')}`;
    }

    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return sql;
  }

  private buildCountSQL(): string {
    let sql = `SELECT COUNT(*) FROM ${this.tableName}`;

    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`;
    }

    return sql;
  }

  private buildCondition(column: string, operator: string, value: any) {
    switch (operator) {
      case 'eq':
        return { sql: `"${column}" = ?`, params: [value] };
      case 'ne':
        return { sql: `"${column}" != ?`, params: [value] };
      case 'gt':
        return { sql: `"${column}" > ?`, params: [value] };
      case 'gte':
        return { sql: `"${column}" >= ?`, params: [value] };
      case 'lt':
        return { sql: `"${column}" < ?`, params: [value] };
      case 'lte':
        return { sql: `"${column}" <= ?`, params: [value] };
      case 'in':
        return {
          sql: `"${column}" IN (${value.map(() => '?').join(', ')})`,
          params: value,
        };
      case 'like':
        return { sql: `"${column}" LIKE ?`, params: [`%${value}%`] };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}

// 轻量级多态关联实现
export class SqlxMorphQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  constructor(
    private client: SqlClient,
    private tableName: string,
    private morphConfig: MorphConfig<TSchema>
  ) {}

  async get(): Promise<any[]> {
    // 基于原生 SQL 实现多态关联查询
    const baseQuery = `SELECT * FROM ${this.tableName}`;
    const baseResult = await this.client.query({ sql: baseQuery, args: [] });
    const baseData = deserializeSqlResult(baseResult);

    // 加载多态关联数据
    const morphResults = await Promise.all(
      baseData.map(async item => {
        const morphType = item[this.morphConfig.typeField];
        const morphId = item[this.morphConfig.idField];

        if (morphType && morphId && this.morphConfig.types[morphType]) {
          const relatedTable = this.morphConfig.types[morphType];
          const relatedQuery = `SELECT * FROM ${relatedTable} WHERE id = ?`;
          const relatedResult = await this.client.query({
            sql: relatedQuery,
            args: [morphId],
          });
          const relatedData = deserializeSqlResult(relatedResult);

          return {
            ...item,
            [this.morphConfig.relationName]: relatedData[0] || null,
          };
        }

        return item;
      })
    );

    return morphResults;
  }
}

// 可选扩展工厂函数
export function createRefineCompat<TSchema extends Record<string, Table>>(
  sqlxProvider: DataProvider,
  schema?: TSchema
): DataProvider & OrmCompatExtension<TSchema> {
  const client = (sqlxProvider as any).client as SqlClient;

  return {
    ...sqlxProvider,

    // 添加链式查询支持
    from<TTable extends keyof TSchema>(
      resource: TTable
    ): SqlxChainQuery<TSchema, TTable> {
      return new SqlxChainQuery(client, resource as string);
    },

    // 添加多态关联支持
    morphTo<TTable extends keyof TSchema>(
      resource: TTable,
      morphConfig: MorphConfig<TSchema>
    ): SqlxMorphQuery<TSchema, TTable> {
      return new SqlxMorphQuery(client, resource as string, morphConfig);
    },
  };
}
```

### 3. 统一的使用模式设计

refine-sqlx 将默认包含 ORM 兼容功能，提供统一的开发体验：

```typescript
// packages/refine-sqlx/src/data-provider.ts - 增强后的统一接口
export default function createRefineSQL<
  TSchema extends Record<string, Table> = {},
>(
  client: SqlClient | SqlClientFactory | string,
  schema?: TSchema,
  options?: SQLiteOptions
): EnhancedDataProvider<TSchema> {
  // 创建基础的 SQL 数据提供者
  const baseProvider = createBaseSQLProvider(client, options);

  // 如果提供了 schema，添加 ORM 兼容功能
  if (schema) {
    return {
      ...baseProvider,

      // 链式查询功能
      from<TTable extends keyof TSchema>(
        resource: TTable
      ): SqlxChainQuery<TSchema, TTable> {
        return new SqlxChainQuery(baseProvider.client, resource as string);
      },

      // 多态关联功能
      morphTo<TTable extends keyof TSchema>(
        resource: TTable,
        morphConfig: MorphConfig<TSchema>
      ): SqlxMorphQuery<TSchema, TTable> {
        return new SqlxMorphQuery(
          baseProvider.client,
          resource as string,
          morphConfig
        );
      },

      // 类型安全的查询方法
      getTyped: async <TTable extends keyof TSchema>(
        resource: TTable,
        params?: GetListParams
      ) => {
        return baseProvider.getList(resource as string, params) as Promise<
          GetListResponse<InferSelectModel<TSchema[TTable]>>
        >;
      },

      createTyped: async <TTable extends keyof TSchema>(
        resource: TTable,
        data: InferInsertModel<TSchema[TTable]>
      ) => {
        return baseProvider.create(resource as string, {
          variables: data,
        }) as Promise<CreateResponse<InferSelectModel<TSchema[TTable]>>>;
      },
    };
  }

  // 没有 schema 时返回基础提供者（但仍包含链式查询能力）
  return {
    ...baseProvider,

    // 无类型约束的链式查询
    from(resource: string): SqlxChainQuery<{}, string> {
      return new SqlxChainQuery(baseProvider.client, resource);
    },
  };
}

// 统一的使用方式
import { createRefineSQL } from 'refine-sqlx';

// 1. 基础用法 - 传统 CRUD + 链式查询
const provider = createRefineSQL(':memory:');

// 传统方式
const users1 = await provider.getList({ resource: 'users' });

// 链式查询方式
const users2 = await provider
  .from('users')
  .where('age', 'gte', 18)
  .orderBy('name')
  .paginate(1, 10)
  .get();

// 2. 类型安全用法 - 提供 schema
const schema = {
  users: sqliteTable('users', {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').unique().notNull(),
    age: integer('age'),
  }),
  posts: sqliteTable('posts', {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    authorId: integer('author_id').references(() => schema.users.id),
  }),
};

const typedProvider = createRefineSQL(':memory:', schema);

// 类型安全的传统方式
const users3 = await typedProvider.getTyped('users', {
  pagination: { current: 1, pageSize: 10 },
});

// 类型安全的链式查询
const users4 = await typedProvider
  .from('users')
  .where('age', 'gte', 18)
  .orderBy('name')
  .get();

// 多态关联查询
const comments = await typedProvider
  .morphTo('comments', {
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .get();

// 3. 完整的 ORM 功能 - 使用独立的 refine-orm 包
import { createRefine, createSQLiteProvider } from 'refine-orm';

const ormProvider = createSQLiteProvider(':memory:', schema);
const advancedUsers = await ormProvider
  .from('users')
  .where('age', 'gte', 18)
  .with('posts', query => query.where('published', 'eq', true))
  .orderBy('name')
  .paginate(1, 10)
  .get();
```

### 4. 包结构和依赖管理

```
packages/
├── refine-sqlx/                    # 增强的轻量级包
│   ├── src/
│   │   ├── client.d.ts            # 核心接口
│   │   ├── data-provider.ts       # 增强的数据提供者
│   │   ├── utils.ts               # SQL 工具函数
│   │   ├── adapters/              # 数据库适配器
│   │   ├── chain-query.ts         # 轻量级链式查询
│   │   ├── morph-query.ts         # 轻量级多态关联
│   │   └── types.ts               # 类型定义
│   └── package.json               # 仍然无 ORM 依赖
│
└── refine-orm/                     # 完整的 ORM 包
    ├── src/
    │   ├── index.ts               # 完整 ORM 功能
    │   ├── chain-query.ts         # 高级链式查询（基于 drizzle）
    │   ├── morph-query.ts         # 高级多态关联（基于 drizzle）
    │   ├── schema-manager.ts      # Schema 管理
    │   └── adapters/              # ORM 适配器
    └── package.json               # 包含 drizzle-orm 依赖
```

### 5. 迁移策略

用户可以根据需求选择不同的使用方式：

1. **传统用法**：继续使用现有的 CRUD API，无需任何更改
2. **增强用法**：使用内置的链式查询和多态关联功能，获得更好的开发体验
3. **类型安全用法**：提供 schema 定义，获得完整的类型推断和验证
4. **完整升级**：迁移到 refine-orm，获得完整的 ORM 功能和高级特性

### 6. 包大小分析

不同使用模式的预估包大小对比：

#### 基础模式 - 纯 refine-sqlx

```
核心文件：
- client.d.ts: ~2KB (类型定义)
- data-provider.ts: ~8KB (核心逻辑)
- utils.ts: ~6KB (SQL 工具函数)
- adapters/: ~15KB (数据库适配器)
- detect-sqlite.ts: ~3KB (运行时检测)

总计: ~34KB (压缩后约 12KB)
依赖: 无额外依赖
```

#### 增强模式 - refine-sqlx + orm-compat 扩展

```
基础包: ~34KB
扩展文件：
- extensions/orm-compat.ts: ~8KB (链式查询实现)
- 类型定义扩展: ~3KB

总计: ~45KB (压缩后约 16KB)
依赖: 无额外依赖 (基于现有 SQL 客户端实现)
```

#### 完整模式 - refine-orm 包

```
核心文件：
- 完整 ORM 实现: ~25KB
- 链式查询构建器: ~15KB
- 多态关联处理: ~8KB
- Schema 管理: ~12KB
- 类型系统: ~10KB

总计: ~70KB (压缩后约 25KB)
依赖:
- drizzle-orm: ~150KB
- 数据库驱动: ~50-200KB (根据数据库类型)
```

#### 对比总结

| 包                   | 包大小     | 压缩后    | 运行时依赖         | 功能级别                              |
| -------------------- | ---------- | --------- | ------------------ | ------------------------------------- |
| refine-sqlx (增强版) | ~45KB      | ~16KB     | 无                 | CRUD + 链式查询 + 多态关联 + 类型安全 |
| refine-orm (完整版)  | ~220-320KB | ~80-120KB | drizzle-orm + 驱动 | 完整 ORM 功能 + 高级特性              |

#### 性能影响

- **refine-sqlx**: 启动时间 < 8ms，内存占用 < 1.5MB
- **refine-orm**: 启动时间 < 20ms，内存占用 < 5MB

这种设计确保了：

- refine-sqlx 保持轻量级和快速启动
- 增强模式仅增加 33% 的包大小，但无运行时依赖
- 用户可以根据需求选择功能级别
- 向后兼容性得到保证
- 包体积得到有效控制

## Schema Management and Migrations

### 1. Schema 定义和管理

```typescript
// packages/refine-orm/src/schema/manager.ts
export class SchemaManager<TSchema extends Record<string, Table>> {
  constructor(private schema: TSchema) {}

  // 自动推断表关系
  inferRelations(): RelationConfig<TSchema> {
    const relations: RelationConfig<TSchema> = {};

    for (const [tableName, table] of Object.entries(this.schema)) {
      relations[tableName] = this.analyzeTableRelations(table);
    }

    return relations;
  }

  // 生成 Zod 验证 schema
  generateValidationSchema(): ValidationSchema<TSchema> {
    const validationSchema: ValidationSchema<TSchema> = {};

    for (const [tableName, table] of Object.entries(this.schema)) {
      validationSchema[tableName] = this.generateTableValidation(table);
    }

    return validationSchema;
  }

  // 生成 TypeScript 类型定义
  generateTypeDefinitions(): string {
    return generateTypesFromSchema(this.schema);
  }
}

// 使用示例
const schema = {
  users: pgTable('users', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  }),
  posts: pgTable('posts', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content'),
    authorId: integer('author_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
  }),
};

const schemaManager = new SchemaManager(schema);
const relations = schemaManager.inferRelations();
const validation = schemaManager.generateValidationSchema();
```

### 2. 数据库迁移

```typescript
// packages/refine-orm/src/migration/migrator.ts
export class DatabaseMigrator<TSchema extends Record<string, Table>> {
  constructor(
    private client: DrizzleClient<TSchema>,
    private schema: TSchema
  ) {}

  async migrate(): Promise<void> {
    const migrations = await this.generateMigrations();

    for (const migration of migrations) {
      await this.executeMigration(migration);
    }
  }

  async generateMigrations(): Promise<Migration[]> {
    // 比较当前数据库结构与 schema 定义
    const currentSchema = await this.introspectDatabase();
    const targetSchema = this.schema;

    return this.diffSchemas(currentSchema, targetSchema);
  }

  private async introspectDatabase(): Promise<DatabaseSchema> {
    // 检查当前数据库结构
  }

  private diffSchemas(current: DatabaseSchema, target: TSchema): Migration[] {
    // 生成迁移脚本
  }
}
```

## CI/CD and Release Strategy

### 1. GitHub Actions 工作流

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
        database: [postgresql, mysql, sqlite]

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: mysql
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test:${{ matrix.database }}
        env:
          DATABASE_URL_POSTGRES: postgresql://postgres:postgres@localhost:5432/test
          DATABASE_URL_MYSQL: mysql://root:mysql@localhost:3306/test
```

### 2. 自动发布工作流

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build packages
        run: bun run build

      - name: Run tests
        run: bun test

      - name: Release
        run: bun run changeset publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Bun Workspace 配置

```json
// package.json (根目录)
{
  "name": "refine-database-adapters",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "bun run --filter='*' build",
    "test": "bun run --filter='*' test",
    "lint": "bun run --filter='*' lint",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "bun run build && changeset publish"
  },
  "devDependencies": { "@changesets/cli": "^2.27.1", "typescript": "^5.3.0" }
}
```

```toml
# bunfig.toml
[install]
# 启用 workspace 支持
peer = true
# 使用更快的安装策略
strategy = "hardlink"

[install.scopes]
# 配置私有包的 scope
"@refine-adapters" = { registry = "https://registry.npmjs.org/" }
```

### 4. 包版本管理

```json
// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

这个设计文档提供了完整的架构规划，包括类型安全的多数据库支持、优雅的 API 设计、Schema-First 开发体验、性能优化、错误处理、测试策略和基于 Bun workspace 的 CI/CD 流程。设计充分利用了 drizzle-orm 的类型推断和现代化特性，提供了比传统 ORM 更优雅的开发体验。
