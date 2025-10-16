/**
 * v0.5.0 - Database View Detector
 *
 * Detects database views and enforces read-only constraints
 */

import { sql } from 'drizzle-orm';
import type { ViewsConfig } from '../../config';
import type { FeatureExecutor } from '../index';

/**
 * View detector and handler
 */
export class ViewDetector implements FeatureExecutor {
  readonly name = 'views';
  readonly enabled: boolean;

  private views = new Set<string>();
  private writableViews = new Set<string>();
  private readonly readOnly: boolean;

  constructor(
    private db: any,
    private schema: Record<string, unknown>,
    private config: ViewsConfig,
  ) {
    this.enabled = config.enabled;
    this.readOnly = config.readOnly ?? true;

    // Register explicitly writable views
    if (config.writableViews) {
      this.writableViews = new Set(config.writableViews);
    }
  }

  /**
   * Initialize view detector - scan database for views
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    if (this.config.autoDetect ?? true) {
      await this.detectViews();
    }
  }

  /**
   * Detect views from database
   */
  private async detectViews(): Promise<void> {
    try {
      // SQLite: Query sqlite_master for views
      const result = await this.db.all(
        sql`SELECT name FROM sqlite_master WHERE type='view'`,
      );

      if (Array.isArray(result)) {
        for (const row of result) {
          const name = (row as any).name;
          if (name) {
            this.views.add(name);
          }
        }
      }
    } catch (error) {
      // If view detection fails, log warning but don't throw
      console.warn('[refine-sqlx] Failed to auto-detect views:', error);
    }
  }

  /**
   * Check if a resource is a view
   */
  isView(resource: string): boolean {
    return this.views.has(resource);
  }

  /**
   * Check if a view is writable
   */
  isWritableView(resource: string): boolean {
    return this.writableViews.has(resource);
  }

  /**
   * Validate write operation on a resource
   * Throws error if trying to write to a read-only view
   */
  validateWrite(resource: string, operation: string): void {
    if (!this.enabled) return;

    // Not a view - allow write
    if (!this.isView(resource)) return;

    // Read-only enforcement disabled - allow write
    if (!this.readOnly) return;

    // View is explicitly writable - allow write
    if (this.isWritableView(resource)) return;

    // Throw error - trying to write to read-only view
    throw new Error(
      `[refine-sqlx] Cannot perform ${operation} on view '${resource}'. ` +
        `Views are read-only. Add to writableViews configuration to enable writes.`,
    );
  }

  /**
   * Manually register a view
   */
  registerView(resource: string, writable = false): void {
    this.views.add(resource);
    if (writable) {
      this.writableViews.add(resource);
    }
  }

  /**
   * Unregister a view
   */
  unregisterView(resource: string): void {
    this.views.delete(resource);
    this.writableViews.delete(resource);
  }

  /**
   * Get all detected views
   */
  getAllViews(): string[] {
    return Array.from(this.views);
  }

  /**
   * Get all writable views
   */
  getWritableViews(): string[] {
    return Array.from(this.writableViews);
  }
}
