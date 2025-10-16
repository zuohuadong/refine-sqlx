import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import type { SqlClient, SqlClientFactory } from './client';
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
 * Time Travel client that wraps SqlClient with automatic backup functionality
 */
export interface TimeTravelClient extends SqlClient {
  /**
   * List all available snapshots
   */
  listSnapshots(): Promise<TimeTravelSnapshot[]>;

  /**
   * Restore database to a specific snapshot
   * @param timestamp - ISO timestamp of the snapshot to restore
   */
  restoreToTimestamp(timestamp: string): Promise<void>;

  /**
   * Restore database to the most recent snapshot before given date
   * @param date - Target date/time
   */
  restoreToDate(date: Date): Promise<void>;

  /**
   * Create a manual snapshot
   * @param label - Optional label for the snapshot
   */
  createSnapshot(label?: string): Promise<TimeTravelSnapshot>;

  /**
   * Cleanup old snapshots based on retention policy
   */
  cleanupSnapshots(): Promise<number>;

  /**
   * Stop the automatic backup scheduler
   */
  stopAutoBackup(): void;
}

/**
 * Create a Time Travel wrapper for SQLite database
 *
 * @param client - The original SqlClient
 * @param dbPath - Path to the SQLite database file
 * @param options - Time Travel configuration options
 */
export function createTimeTravelClient(
  client: SqlClient,
  dbPath: string,
  options: TimeTravelOptions,
): TimeTravelClient {
  const backupDir = options.backupDir ?? './.time-travel';
  const intervalSeconds = options.intervalSeconds ?? 60;
  const retentionDays = options.retentionDays ?? 30;

  let backupTimer: Timer | NodeJS.Timeout | null = null;

  // Ensure backup directory exists
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // Start automatic backup if enabled
  if (options.enabled) {
    startAutoBackup();
  }

  /**
   * Generate snapshot filename
   */
  function generateSnapshotFilename(label?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const labelSuffix = label ? `-${label}` : '';
    return `snapshot-${timestamp}${labelSuffix}.db`;
  }

  /**
   * Create a database snapshot
   */
  async function createSnapshot(label?: string): Promise<TimeTravelSnapshot> {
    if (!existsSync(dbPath)) {
      throw new Error(`Database file not found: ${dbPath}`);
    }

    const filename = generateSnapshotFilename(label);
    const snapshotPath = join(backupDir, filename);
    const createdAt = Date.now();

    // Copy the database file
    copyFileSync(dbPath, snapshotPath);

    return {
      timestamp: new Date(createdAt).toISOString(),
      path: snapshotPath,
      createdAt,
    };
  }

  /**
   * List all available snapshots
   */
  async function listSnapshots(): Promise<TimeTravelSnapshot[]> {
    if (!existsSync(backupDir)) {
      return [];
    }

    const files = readdirSync(backupDir);
    const snapshots: TimeTravelSnapshot[] = [];

    for (const file of files) {
      if (file.startsWith('snapshot-') && file.endsWith('.db')) {
        const filePath = join(backupDir, file);
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
  async function restoreToTimestamp(timestamp: string): Promise<void> {
    const snapshots = await listSnapshots();
    const snapshot = snapshots.find((s) => s.timestamp === timestamp);

    if (!snapshot) {
      throw new Error(`Snapshot not found for timestamp: ${timestamp}`);
    }

    if (!existsSync(snapshot.path)) {
      throw new Error(`Snapshot file not found: ${snapshot.path}`);
    }

    // Create a backup of current state before restoring
    await createSnapshot('pre-restore');

    // Copy snapshot to database location
    copyFileSync(snapshot.path, dbPath);
  }

  /**
   * Restore database to the most recent snapshot before given date
   */
  async function restoreToDate(date: Date): Promise<void> {
    const targetTime = date.getTime();
    const snapshots = await listSnapshots();

    // Find the most recent snapshot before the target date
    const snapshot = snapshots.find((s) => s.createdAt <= targetTime);

    if (!snapshot) {
      throw new Error(`No snapshot found before ${date.toISOString()}`);
    }

    await restoreToTimestamp(snapshot.timestamp);
  }

  /**
   * Cleanup old snapshots based on retention policy
   */
  async function cleanupSnapshots(): Promise<number> {
    const snapshots = await listSnapshots();
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
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
  function startAutoBackup(): void {
    if (backupTimer) return;

    // Create initial snapshot
    createSnapshot('auto').catch((error) => {
      console.error('Failed to create initial snapshot:', error);
    });

    // Schedule regular backups
    backupTimer = setInterval(async () => {
      try {
        await createSnapshot('auto');
        await cleanupSnapshots();
      } catch (error) {
        console.error('Auto-backup failed:', error);
      }
    }, intervalSeconds * 1000);
  }

  /**
   * Stop automatic backup scheduler
   */
  function stopAutoBackup(): void {
    if (backupTimer) {
      clearInterval(backupTimer);
      backupTimer = null;
    }
  }

  // Return wrapped client with Time Travel capabilities
  return {
    ...client,
    listSnapshots,
    restoreToTimestamp,
    restoreToDate,
    createSnapshot,
    cleanupSnapshots,
    stopAutoBackup,
  };
}

/**
 * Create a Time Travel-enabled SqlClientFactory
 */
export function createTimeTravelFactory(
  factory: SqlClientFactory,
  dbPath: string,
  options: TimeTravelOptions,
): SqlClientFactory {
  return {
    async connect(): Promise<TimeTravelClient> {
      const client = await factory.connect();
      return createTimeTravelClient(client, dbPath, options);
    },
  };
}
