// 导出主要功能
export { ormDataProvider } from "./provider";
export { DrizzleOrmAdapter } from "./adapter";

// 导出类型
export type {
  DatabaseConnection,
  SupportedDatabase,
  OrmConfig,
  Transaction,
  OrmAdapter
} from "./types";

// 重新导出 BaseRecord
export type { BaseRecord } from "@refinedev/core";
