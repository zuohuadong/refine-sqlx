/**
 * Live Provider implementation for real-time updates
 * Supports polling, WebSocket (Bun/Node), and Cloudflare D1 strategies
 */

import type { LiveEvent, LiveProvider } from '@refinedev/core';

/**
 * Live mode configuration
 */
export interface LiveModeConfig {
  /**
   * Enable live mode
   * @default false
   */
  enabled?: boolean;

  /**
   * Live mode strategy
   * - 'polling': Regular polling (all platforms)
   * - 'websocket': WebSocket-based (Bun/Node only)
   * - 'durable-objects': Cloudflare Durable Objects (D1 only)
   * @default 'polling'
   */
  strategy?: 'polling' | 'websocket' | 'durable-objects';

  /**
   * Polling interval in milliseconds
   * @default 5000
   */
  pollingInterval?: number;

  /**
   * WebSocket server port (when strategy is 'websocket')
   * @default 3001
   */
  port?: number;

  /**
   * Durable Object namespace (when strategy is 'durable-objects')
   */
  durableObjectNamespace?: any;
}

/**
 * Event emitter for live updates
 */
export class LiveEventEmitter {
  private listeners = new Map<string, Set<(event: LiveEvent) => void>>();

  /**
   * Subscribe to events on a channel
   */
  on(channel: string, callback: (event: LiveEvent) => void): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }

    this.listeners.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(channel)?.delete(callback);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  emit(channel: string, event: LiveEvent): void {
    const callbacks = this.listeners.get(channel);
    if (callbacks) {
      callbacks.forEach((callback) => callback(event));
    }
  }

  /**
   * Clear all listeners for a channel
   */
  clear(channel: string): void {
    this.listeners.delete(channel);
  }

  /**
   * Clear all listeners
   */
  clearAll(): void {
    this.listeners.clear();
  }
}

/**
 * Polling strategy for live updates
 */
export class PollingStrategy {
  private intervals = new Map<string, NodeJS.Timeout>();
  private lastFetch = new Map<string, number>();

  constructor(
    private emitter: LiveEventEmitter,
    private interval: number = 5000,
  ) {}

  /**
   * Start polling for a resource
   */
  start(
    channel: string,
    resource: string,
    fetchData: () => Promise<any>,
  ): void {
    if (this.intervals.has(channel)) {
      return; // Already polling
    }

    const poll = async () => {
      try {
        const data = await fetchData();
        const now = Date.now();
        const lastFetchTime = this.lastFetch.get(channel);

        // Only emit if data changed (simple check)
        if (!lastFetchTime || JSON.stringify(data) !== this.lastCache?.get(channel)) {
          this.emitter.emit(channel, {
            type: 'created', // or 'updated', 'deleted'
            channel,
            date: new Date(now),
            payload: { ids: [] }, // Should extract actual IDs
          });
        }

        this.lastFetch.set(channel, now);
      } catch (error) {
        console.error(`[Live Polling] Error polling ${channel}:`, error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, this.interval);
    this.intervals.set(channel, intervalId);
  }

  /**
   * Stop polling for a channel
   */
  stop(channel: string): void {
    const intervalId = this.intervals.get(channel);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(channel);
      this.lastFetch.delete(channel);
    }
  }

  /**
   * Stop all polling
   */
  stopAll(): void {
    this.intervals.forEach((intervalId) => clearInterval(intervalId));
    this.intervals.clear();
    this.lastFetch.clear();
  }

  private lastCache = new Map<string, string>();
}

/**
 * Create a Live Provider for real-time updates
 */
export function createLiveProvider(
  config: LiveModeConfig,
  emitter: LiveEventEmitter,
): LiveProvider {
  const pollingStrategy = new PollingStrategy(
    emitter,
    config.pollingInterval ?? 5000,
  );

  return {
    subscribe: ({ channel, types, params, callback }) => {
      const unsubscribe = emitter.on(channel, (event) => {
        if (types.includes(event.type)) {
          callback(event);
        }
      });

      // Start polling if using polling strategy
      if (config.strategy === 'polling' && params?.resource) {
        // Note: We need access to dataProvider to fetch data
        // This is a simplified implementation
        pollingStrategy.start(channel, params.resource, async () => {
          // Fetch data logic would go here
          return {};
        });
      }

      return unsubscribe;
    },

    unsubscribe: (subscription) => {
      if (typeof subscription === 'function') {
        subscription();
      }
    },

    publish: (event) => {
      emitter.emit(event.channel, event);
    },
  };
}

/**
 * WebSocket strategy (Bun/Node only)
 * Note: This requires additional setup and is platform-specific
 */
export class WebSocketStrategy {
  private server: any;

  constructor(
    private emitter: LiveEventEmitter,
    private port: number = 3001,
  ) {}

  /**
   * Start WebSocket server
   */
  async start(): Promise<void> {
    // Platform detection
    if (typeof Bun !== 'undefined') {
      this.startBunServer();
    } else {
      // Node.js WebSocket server would go here
      console.warn(
        '[Live WebSocket] WebSocket strategy requires Bun or Node.js with ws package',
      );
    }
  }

  /**
   * Start Bun WebSocket server
   */
  private startBunServer(): void {
    // This is a placeholder - actual implementation would use Bun.serve
    console.log(`[Live WebSocket] Starting WebSocket server on port ${this.port}`);
    // Bun.serve({ port: this.port, ... })
  }

  /**
   * Stop WebSocket server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
    }
  }

  /**
   * Broadcast event to all WebSocket clients
   */
  broadcast(channel: string, event: LiveEvent): void {
    // Broadcast to WebSocket clients
    this.emitter.emit(channel, event);
  }
}
