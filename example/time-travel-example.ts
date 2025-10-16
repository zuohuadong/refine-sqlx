/**
 * Time Travel Example
 *
 * This example demonstrates how to use Time Travel functionality
 * for automatic backup and restore of SQLite databases.
 */

import { createRefineSQL, type DataProviderWithTimeTravel } from 'refine-sqlx';
import * as schema from './schema';

async function main() {
  // Create data provider with Time Travel enabled
  const dataProvider: DataProviderWithTimeTravel = await createRefineSQL({
    connection: './example-database.sqlite',
    schema,
    timeTravel: {
      enabled: true,
      backupDir: './.time-travel', // Where backups are stored
      intervalSeconds: 60, // Create backup every 60 seconds
      retentionDays: 30, // Keep backups for 30 days
    },
  });

  console.log('✅ Data provider with Time Travel initialized');

  // Example 1: Create a manual snapshot
  console.log('\n📸 Creating manual snapshot...');
  const snapshot = await dataProvider.createSnapshot?.('before-data-migration');
  console.log('Snapshot created:', snapshot);

  // Example 2: List all available snapshots
  console.log('\n📋 Listing all snapshots...');
  const snapshots = await dataProvider.listSnapshots?.();
  console.log(`Found ${snapshots?.length || 0} snapshots:`);
  snapshots?.forEach((s) => {
    console.log(`  - ${s.timestamp} (${s.path})`);
  });

  // Example 3: Restore to a specific timestamp
  if (snapshots && snapshots.length > 0) {
    console.log('\n⏮️ Restoring to most recent snapshot...');
    await dataProvider.restoreToTimestamp?.(snapshots[0].timestamp);
    console.log('Database restored successfully');
  }

  // Example 4: Restore to a specific date
  console.log('\n📅 Restoring to date...');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  try {
    await dataProvider.restoreToDate?.(yesterday);
    console.log('Database restored to yesterday');
  } catch (error) {
    console.log('No snapshot found for yesterday (expected in fresh setup)');
  }

  // Example 5: Cleanup old snapshots
  console.log('\n🧹 Cleaning up old snapshots...');
  const deletedCount = await dataProvider.cleanupSnapshots?.();
  console.log(`Deleted ${deletedCount} old snapshots`);

  // Example 6: Stop automatic backups (important when shutting down)
  console.log('\n⏹️ Stopping automatic backups...');
  dataProvider.stopAutoBackup?.();
  console.log('Automatic backups stopped');

  console.log('\n✅ Time Travel example completed successfully!');
}

// Run the example
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
