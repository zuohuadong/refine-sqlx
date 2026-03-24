/**
 * Framework-agnostic Live Provider types for refine-sqlx
 *
 * These types are structurally compatible with both @refinedev/core and @svadmin/core.
 */

import type { DataProvider } from './data-provider';

// ─── LiveEvent ─────────────────────────────────────────────────

export interface LiveEvent {
  channel: string;
  type: 'created' | 'updated' | 'deleted' | '*';
  date: Date;
  payload?: {
    ids?: (string | number)[];
    data?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ─── LiveProvider ──────────────────────────────────────────────

export interface LiveProvider {
  subscribe: (params: {
    channel: string;
    types: LiveEvent['type'][];
    params?: {
      resource?: string;
      [key: string]: unknown;
    };
    callback: (event: LiveEvent) => void;
  }) => (() => void) | undefined;

  unsubscribe: (subscription: (() => void) | undefined) => void;

  publish?: (event: LiveEvent) => void;
}

export type { DataProvider };
