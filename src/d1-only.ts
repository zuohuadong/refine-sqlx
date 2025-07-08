// D1-only export - optimized for Cloudflare Workers
export { dataProvider } from "./provider";
export { DatabaseAdapter } from "./database";
export type { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from "./types";

// Re-export utilities for D1-specific usage
export * from "./utils";
