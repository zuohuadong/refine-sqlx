import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import type { TimeTravelOptions } from './types';

/**
 * Time Travel snapshot metadata
 */
export interface TimeTravelSnapshot {
  /** Snapshot timestamp in ISO format */
  timestamp: string;
  /** File path to the snapshot */
  path: string;
  /** Snapshot creation time in milliseconds since epoch */
  createdAt: number;
}

/**
 * Time Travel manager for SQLite databases
 * Provides backup and restore functionality through file system operations
 */
export class TimeTravelManager {
  private backupDir: string;
  private intervalSeconds: number;
  private retentionDays: number;
  private backupTimer: Timer | NodeJS.Timeout | null = null;

  constructor(
    private dbPath: string,
    options: TimeTravelOptions,
  ) {
    this.backupDir = options.backupDir ?? './.time-travel';
    this.intervalSeconds = options.intervalSeconds ?? 86400; // 1 day
    this.retentionDays = options.retentionDays ?? 30;

    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    // Start automatic backup if enabled
    if (options.enabled) {
      this.startAutoBackup();
    }
  }

  /**
   * Generate snapshot filename
   */
  private generateSnapshotFilename(label?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const labelSuffix = label ? `-${label}` : '';
    return `snapshot-${timestamp}${labelSuffix}.db`;
  }

  /**
   * Create a database snapshot
   */
  async createSnapshot(label?: string): Promise<TimeTravelSnapshot> {
    if (!existsSync(this.dbPath)) {
      throw new Error(`Database file not found: ${this.dbPath}`);
    }

    const filename = this.generateSnapshotFilename(label);
    const snapshotPath = join(this.backupDir, filename);
    const createdAt = Date.now();

    // Copy the database file
    copyFileSync(this.dbPath, snapshotPath);

    return {
      timestamp: new Date(createdAt).toISOString(),
      path: snapshotPath,
      createdAt,
    };
  }

  /**
   * List all available snapshots
   */
  async listSnapshots(): Promise<TimeTravelSnapshot[]> {
    if (!existsSync(this.backupDir)) {
      return [];
    }

    const files = readdirSync(this.backupDir);
    const snapshots: TimeTravelSnapshot[] = [];

    for (const file of files) {
      if (file.startsWith('snapshot-') && file.endsWith('.db')) {
        const filePath = join(this.backupDir, file);
        const stats = statSync(filePath);

        snapshots.push({
          timestamp: new Date(stats.mtime).toISOString(),
          path: filePath,
          createdAt: stats.mtimeMs,
        });
      }
    }

    // Sort by creation time, newest first
    return snapshots.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Restore database to a specific snapshot
   */
  async restoreToTimestamp(timestamp: string): Promise<void> {
    const snapshots = await this.listSnapshots();
    const snapshot = snapshots.find((s) => s.timestamp === timestamp);

    if (!snapshot) {
      throw new Error(`Snapshot not found for timestamp: ${timestamp}`);
    }

    if (!existsSync(snapshot.path)) {
      throw new Error(`Snapshot file not found: ${snapshot.path}`);
    }

    // Create a backup of current state before restoring
    await this.createSnapshot('pre-restore');

    // Copy snapshot to database location
    copyFileSync(snapshot.path, this.dbPath);
  }

  /**
   * Restore database to the most recent snapshot before given date
   */
  async restoreToDate(date: Date): Promise<void> {
    const targetTime = date.getTime();
    const snapshots = await this.listSnapshots();

    // Find the most recent snapshot before the target date
    const snapshot = snapshots.find((s) => s.createdAt <= targetTime);

    if (!snapshot) {
      throw new Error(`No snapshot found before ${date.toISOString()}`);
    }

    await this.restoreToTimestamp(snapshot.timestamp);
  }

  /**
   * Cleanup old snapshots based on retention policy
   */
  async cleanupSnapshots(): Promise<number> {
    const snapshots = await this.listSnapshots();
    const cutoffTime = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const snapshot of snapshots) {
      // Don't delete pre-restore snapshots or recent snapshots
      if (
        snapshot.createdAt < cutoffTime &&
        !snapshot.path.includes('pre-restore')
      ) {
        try {
          unlinkSync(snapshot.path);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete snapshot ${snapshot.path}:`, error);
        }
      }
    }

    return deletedCount;
  }

  /**
   * Start automatic backup scheduler
   */
  private startAutoBackup(): void {
    if (this.backupTimer) return;

    // Create initial snapshot
    this.createSnapshot('auto').catch((error) => {
      console.error('Failed to create initial snapshot:', error);
    });

    // Schedule regular backups
    this.backupTimer = setInterval(async () => {
      try {
        await this.createSnapshot('auto');
        await this.cleanupSnapshots();
      } catch (error) {
        console.error('Auto-backup failed:', error);
      }
    }, this.intervalSeconds * 1000);
  }

  /**
   * Stop automatic backup scheduler
   */
  stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }
}
