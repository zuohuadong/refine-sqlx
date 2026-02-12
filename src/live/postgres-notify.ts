/**
 * PostgreSQL LISTEN/NOTIFY Real-time Subscription
 *
 * This module provides real-time subscriptions using PostgreSQL's native
 * LISTEN/NOTIFY mechanism. This is a temporary implementation until
 * Drizzle ORM provides native support for real-time subscriptions.
 *
 * @deprecated Will be removed when Drizzle ORM adds native real-time support
 *
 * @example
 * ```typescript
 * import { PostgresNotifyStrategy } from 'refine-sqlx/live/postgres-notify';
 *
 * const strategy = new PostgresNotifyStrategy({
 *   connectionString: process.env.DATABASE_URL,
 *   channels: ['users', 'posts'],
 * });
 *
 * strategy.subscribe('users', (event) => {
 *   console.log('User changed:', event);
 * });
 * ```
 */

export interface PostgresNotifyConfig {
  connectionString?: string;
  pool?: unknown;
  channels: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface PostgresNotifyEvent {
  channel: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  id: string | number;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface PostgresNotifySubscription {
  channel: string;
  callback: (event: PostgresNotifyEvent) => void;
  unsubscribe: () => void;
}

type PostgresNotifyCallback = (event: PostgresNotifyEvent) => void;

interface NotificationMessage {
  channel: string;
  payload?: string;
}

interface PostgresClient {
  query: (sql: string) => Promise<void>;
  on: (event: 'notification' | 'error', callback: (arg: unknown) => void) => void;
  release: () => void;
}

interface PostgresPool {
  connect: () => Promise<PostgresClient>;
  end: () => Promise<void>;
}

/**
 * PostgreSQL LISTEN/NOTIFY Strategy for real-time subscriptions
 *
 * Uses PostgreSQL's native LISTEN/NOTIFY mechanism to receive
 * real-time notifications when data changes.
 */
export class PostgresNotifyStrategy {
  private pool: PostgresPool | null = null;
  private client: PostgresClient | null = null;
  private listeners = new Map<string, Set<PostgresNotifyCallback>>();
  private channels = new Set<string>();
  private reconnectAttempts = 0;
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;

  constructor(private config: PostgresNotifyConfig) {
    this.channels = new Set(config.channels);
    this.reconnectInterval = config.reconnectInterval ?? 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      if (this.config.pool) {
        this.pool = this.config.pool as PostgresPool;
      } else if (this.config.connectionString) {
        // Dynamic import of pg module - user must have pg installed
        // Using Function constructor to avoid TypeScript module resolution
        const loadPg = new Function('return import("pg")') as () => Promise<{ Pool: new (config: { connectionString: string }) => PostgresPool }>;
        const pg = await loadPg().catch(() => {
          throw new Error('[PostgresNotify] pg module not found. Install it with: npm install pg');
        });
        this.pool = new pg.Pool({ connectionString: this.config.connectionString });
      } else {
        throw new Error('[PostgresNotify] Either pool or connectionString is required');
      }

      this.client = await this.pool.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.client.on('notification', (msg: unknown) => {
        this.handleNotification(msg as NotificationMessage);
      });

      this.client.on('error', (err: unknown) => {
        console.error('[PostgresNotify] Connection error:', err);
        this.handleDisconnect();
      });

      for (const channel of this.channels) {
        await this.client.query(`LISTEN ${this.sanitizeChannelName(channel)}`);
      }

      console.log(`[PostgresNotify] Connected and listening to: ${Array.from(this.channels).join(', ')}`);
    } catch (error) {
      console.error('[PostgresNotify] Connection failed:', error);
      this.handleDisconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        for (const channel of this.channels) {
          await this.client.query(`UNLISTEN ${this.sanitizeChannelName(channel)}`);
        }
        this.client.release();
      } catch (error) {
        console.error('[PostgresNotify] Error during disconnect:', error);
      }
      this.client = null;
    }

    if (this.pool && !this.config.pool) {
      await this.pool.end();
      this.pool = null;
    }

    this.isConnected = false;
  }

  subscribe(channel: string, callback: PostgresNotifyCallback): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }

    this.listeners.get(channel)!.add(callback);

    if (!this.channels.has(channel)) {
      this.channels.add(channel);
      if (this.isConnected && this.client) {
        this.client.query(`LISTEN ${this.sanitizeChannelName(channel)}`).catch((err: unknown) => {
          console.error(`[PostgresNotify] Failed to listen to ${channel}:`, err);
        });
      }
    }

    return () => {
      this.listeners.get(channel)?.delete(callback);
      if (this.listeners.get(channel)?.size === 0) {
        this.listeners.delete(channel);
      }
    };
  }

  async addChannel(channel: string): Promise<void> {
    if (this.channels.has(channel)) return;

    this.channels.add(channel);

    if (this.isConnected && this.client) {
      await this.client.query(`LISTEN ${this.sanitizeChannelName(channel)}`);
    }
  }

  async removeChannel(channel: string): Promise<void> {
    if (!this.channels.has(channel)) return;

    this.channels.delete(channel);
    this.listeners.delete(channel);

    if (this.isConnected && this.client) {
      await this.client.query(`UNLISTEN ${this.sanitizeChannelName(channel)}`);
    }
  }

  private handleNotification(msg: { channel: string; payload?: string }): void {
    if (!msg.payload) return;

    try {
      const payload = JSON.parse(msg.payload) as PostgresNotifyEvent;
      const callbacks = this.listeners.get(msg.channel);

      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback({
              ...payload,
              timestamp: new Date(),
            });
          } catch (err) {
            console.error(`[PostgresNotify] Callback error for ${msg.channel}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[PostgresNotify] Failed to parse notification:`, err);
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[PostgresNotify] Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      this.reconnectTimer = setTimeout(() => {
        this.connect().catch((err) => {
          console.error('[PostgresNotify] Reconnect failed:', err);
        });
      }, this.reconnectInterval);
    } else {
      console.error('[PostgresNotify] Max reconnect attempts reached');
    }
  }

  private sanitizeChannelName(channel: string): string {
    return channel.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  getChannels(): string[] {
    return Array.from(this.channels);
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

export function createPostgresNotifyTriggerSQL(
  table: string,
  channel: string,
  idColumn: string = 'id',
): string {
  const triggerName = `notify_${table}_changes`;
  const functionName = `notify_${table}_changes_fn`;

  return `
-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS ${triggerName} ON ${table};
DROP FUNCTION IF EXISTS ${functionName}();

-- Create notification function
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload = jsonb_build_object(
      'channel', '${channel}',
      'action', 'INSERT',
      'table', '${table}',
      'id', NEW.${idColumn},
      'data', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload = jsonb_build_object(
      'channel', '${channel}',
      'action', 'UPDATE',
      'table', '${table}',
      'id', NEW.${idColumn},
      'data', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload = jsonb_build_object(
      'channel', '${channel}',
      'action', 'DELETE',
      'table', '${table}',
      'id', OLD.${idColumn}
    );
  END IF;

  PERFORM pg_notify('${channel}', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER ${triggerName}
AFTER INSERT OR UPDATE OR DELETE ON ${table}
FOR EACH ROW EXECUTE FUNCTION ${functionName}();
`.trim();
}

export function dropPostgresNotifyTriggerSQL(table: string): string {
  const triggerName = `notify_${table}_changes`;
  const functionName = `notify_${table}_changes_fn`;

  return `
DROP TRIGGER IF EXISTS ${triggerName} ON ${table};
DROP FUNCTION IF EXISTS ${functionName}();
`.trim();
}
