/**
 * Live Queries / Real-time Subscriptions
 *
 * Supports:
 * - Polling strategy (all platforms)
 * - PostgreSQL LISTEN/NOTIFY (PostgreSQL only)
 *
 * @deprecated PostgreSQL LISTEN/NOTIFY will be removed when Drizzle ORM adds native real-time support
 */

export {
  createLiveProvider,
  createLiveProviderAsync,
  LiveEventEmitter,
  PollingStrategy,
  PostgresNotifyStrategy,
  createPostgresNotifyTriggerSQL,
  dropPostgresNotifyTriggerSQL,
} from './provider';

export type {
  LiveModeConfig,
  PostgresNotifyConfig,
  PostgresNotifyEvent,
  PostgresNotifySubscription,
} from './provider';
