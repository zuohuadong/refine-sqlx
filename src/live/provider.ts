/**
 * Live Provider implementation for real-time updates
 * Supports polling strategy for all platforms
 */

import type { DataProvider, LiveEvent, LiveProvider } from '@refinedev/core';

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
   * @default 'polling'
   */
  strategy?: 'polling';

  /**
   * Polling interval in milliseconds
   * @default 5000
   */
  pollingInterval?: number;
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
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private lastFetch = new Map<string, number>();
  private lastCache = new Map<string, string>();

  constructor(
    private emitter: LiveEventEmitter,
    private interval: number = 5000,
  ) { }

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
        const serialized = JSON.stringify(data);
        const cached = this.lastCache.get(channel);

        // Only emit if data actually changed (skip first poll)
        if (cached !== undefined && cached !== serialized) {
          this.emitter.emit(channel, {
            type: 'created',
            channel,
            date: new Date(),
            payload: { ids: [] },
          });
        }

        this.lastCache.set(channel, serialized);
        this.lastFetch.set(channel, Date.now());
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
      this.lastCache.delete(channel);
    }
  }

  /**
   * Stop all polling
   */
  stopAll(): void {
    this.intervals.forEach((intervalId) => clearInterval(intervalId));
    this.intervals.clear();
    this.lastFetch.clear();
    this.lastCache.clear();
  }
}

/**
 * Create a Live Provider for real-time updates
 *
 * @param config - Live mode configuration
 * @param emitter - Event emitter for broadcasting events
 * @param dataProvider - Optional DataProvider for polling strategy data fetching
 */
export function createLiveProvider(
  config: LiveModeConfig,
  emitter: LiveEventEmitter,
  dataProvider?: DataProvider,
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
      if (config.strategy === 'polling' && params?.resource && dataProvider) {
        pollingStrategy.start(channel, params.resource, async () => {
          const result = await dataProvider.getList({
            resource: params.resource!,
            pagination: { currentPage: 1, pageSize: 100 },
          });
          return result.data;
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
