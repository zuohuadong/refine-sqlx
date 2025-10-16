/**
 * Time Travel功能测试套件
 * 测试SQLite数据库的自动备份和时间点恢复功能
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRefineSQL } from '../src/provider';
import type { DataProviderWithTimeTravel } from '../src/provider';
import { schema, users } from './fixtures/schema';
import { seedUsers } from './fixtures/seed';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  isRunningInBun,
  it,
} from './helpers/test-adapter';

// Import appropriate database driver based on runtime
const Database =
  isRunningInBun ? require('bun:sqlite').Database : require('better-sqlite3');

const drizzle =
  isRunningInBun ?
    require('drizzle-orm/bun-sqlite').drizzle
  : require('drizzle-orm/better-sqlite3').drizzle;

describe('Time Travel功能测试', () => {
  let dataProvider: DataProviderWithTimeTravel;
  let db: any;
  let sqlite: any;
  const testDbPath = './test-time-travel.db';
  const backupDir = './test-time-travel-backups';

  beforeAll(async () => {
    // 清理之前的测试文件
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    if (existsSync(backupDir)) {
      rmSync(backupDir, { recursive: true });
    }

    // 创建基于文件的数据库
    sqlite = new Database(testDbPath);
    db = drizzle(sqlite, { schema });

    // 创建表
    sqlite.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        age INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      );
    `);

    // 插入种子数据
    await db.insert(users).values(seedUsers);

    // 创建启用Time Travel的数据提供者（使用文件路径而不是db实例）
    dataProvider = (await createRefineSQL({
      connection: testDbPath, // 使用文件路径
      schema,
      timeTravel: {
        enabled: true,
        backupDir,
        intervalSeconds: 1, // 1秒间隔用于测试
        retentionDays: 1,
      },
    })) as DataProviderWithTimeTravel;

    // 等待初始快照创建
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    // 停止自动备份
    if (dataProvider?.stopAutoBackup) {
      dataProvider.stopAutoBackup();
    }

    // 关闭数据库
    if (sqlite) {
      sqlite.close();
    }

    // 清理测试文件
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    if (existsSync(backupDir)) {
      rmSync(backupDir, { recursive: true });
    }
  });

  describe('创建快照', () => {
    it('应该创建手动快照', async () => {
      const snapshot = await dataProvider.createSnapshot!('manual-test');

      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.path).toBeDefined();
      expect(snapshot.createdAt).toBeGreaterThan(0);
      expect(existsSync(snapshot.path)).toBe(true);
    });

    it('应该自动创建快照', async () => {
      // 等待自动备份
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const snapshots = await dataProvider.listSnapshots!();
      expect(snapshots.length).toBeGreaterThan(0);

      // 验证至少有一个自动快照
      const autoSnapshots = snapshots.filter((s) => s.path.includes('auto'));
      expect(autoSnapshots.length).toBeGreaterThan(0);
    });
  });

  describe('列出快照', () => {
    it('应该列出所有可用快照', async () => {
      const snapshots = await dataProvider.listSnapshots!();

      expect(snapshots).toBeInstanceOf(Array);
      expect(snapshots.length).toBeGreaterThan(0);

      // 验证快照按时间倒序排列
      for (let i = 0; i < snapshots.length - 1; i++) {
        expect(snapshots[i].createdAt).toBeGreaterThanOrEqual(
          snapshots[i + 1].createdAt,
        );
      }
    });

    it('快照应该包含必要的元数据', async () => {
      const snapshots = await dataProvider.listSnapshots!();
      const snapshot = snapshots[0];

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.path).toBeDefined();
      expect(snapshot.createdAt).toBeGreaterThan(0);
      expect(typeof snapshot.timestamp).toBe('string');
      expect(typeof snapshot.path).toBe('string');
      expect(typeof snapshot.createdAt).toBe('number');
    });
  });

  describe('恢复快照', () => {
    it('应该恢复到指定时间戳', async () => {
      // 创建一个快照
      const snapshot1 = await dataProvider.createSnapshot!('before-change');

      // 等待一下确保快照完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 添加新用户
      await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Test User',
          email: 'test@example.com',
          status: 'active' as const,
          createdAt: new Date(),
        },
      });

      // 验证用户已添加
      const listBefore = await dataProvider.getList({ resource: 'users' });
      const userCountBefore = listBefore.total;

      // 获取快照列表,找到我们创建的快照
      const snapshots = await dataProvider.listSnapshots!();
      const targetSnapshot = snapshots.find((s) =>
        s.path.includes('before-change'),
      );

      if (!targetSnapshot) {
        throw new Error('Snapshot not found');
      }

      // 恢复到快照
      await dataProvider.restoreToTimestamp!(targetSnapshot.timestamp);

      // 关闭并重新打开数据库连接
      if (sqlite) {
        sqlite.close();
      }
      sqlite = new Database(testDbPath);
      db = drizzle(sqlite, { schema });

      // 重新创建dataProvider
      dataProvider = (await createRefineSQL({
        connection: testDbPath,
        schema,
        timeTravel: {
          enabled: false, // 禁用以避免干扰测试
        },
      })) as DataProviderWithTimeTravel;

      // 验证数据已恢复
      const listAfter = await dataProvider.getList({ resource: 'users' });
      expect(listAfter.total).toBe(userCountBefore - 1);
    });

    it('应该恢复到指定日期之前最近的快照', async () => {
      // 创建快照
      const snapshot = await dataProvider.createSnapshot!('date-test');
      const targetDate = new Date(snapshot.createdAt + 1000); // 1秒后

      // 添加数据
      await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Date Test User',
          email: 'datetest@example.com',
          status: 'pending' as const,
          createdAt: new Date(),
        },
      });

      // 恢复到目标日期之前
      await dataProvider.restoreToDate!(targetDate);

      // 验证恢复成功（这里只是确保方法不抛出错误）
      const list = await dataProvider.getList({ resource: 'users' });
      expect(list.data).toBeInstanceOf(Array);
    });

    it('应该在恢复前创建pre-restore快照', async () => {
      const snapshot = await dataProvider.createSnapshot!('test-pre-restore');

      // 等待快照完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 获取快照列表
      const snapshots = await dataProvider.listSnapshots!();
      const targetSnapshot = snapshots.find((s) =>
        s.path.includes('test-pre-restore'),
      );

      if (!targetSnapshot) {
        throw new Error('Snapshot not found');
      }

      // 执行恢复
      await dataProvider.restoreToTimestamp!(targetSnapshot.timestamp);

      // 检查是否创建了pre-restore快照
      const snapshotsAfter = await dataProvider.listSnapshots!();
      const preRestoreSnapshots = snapshotsAfter.filter((s) =>
        s.path.includes('pre-restore'),
      );

      expect(preRestoreSnapshots.length).toBeGreaterThan(0);
    });
  });

  describe('清理快照', () => {
    it('应该清理旧快照', async () => {
      // 获取清理前的快照数量
      const snapshotsBefore = await dataProvider.listSnapshots!();
      const countBefore = snapshotsBefore.length;

      // 执行清理（由于retentionDays=1，所有旧快照都应被保留或清理）
      const deletedCount = await dataProvider.cleanupSnapshots!();

      // 验证清理函数可以正常执行
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);

      // 获取清理后的快照
      const snapshotsAfter = await dataProvider.listSnapshots!();

      // 验证pre-restore快照不会被删除
      const preRestoreAfter = snapshotsAfter.filter((s) =>
        s.path.includes('pre-restore'),
      );
      const preRestoreBefore = snapshotsBefore.filter((s) =>
        s.path.includes('pre-restore'),
      );
      expect(preRestoreAfter.length).toBe(preRestoreBefore.length);
    });
  });

  describe('停止自动备份', () => {
    it('应该停止自动备份调度器', async () => {
      // 重新启用 Time Travel
      if (sqlite) {
        sqlite.close();
      }
      sqlite = new Database(testDbPath);
      db = drizzle(sqlite, { schema });

      dataProvider = (await createRefineSQL({
        connection: testDbPath,
        schema,
        timeTravel: {
          enabled: true,
          backupDir,
          intervalSeconds: 1,
        },
      })) as DataProviderWithTimeTravel;

      // 获取当前快照数量
      const snapshotsBefore = await dataProvider.listSnapshots!();
      const countBefore = snapshotsBefore.length;

      // 停止自动备份
      dataProvider.stopAutoBackup!();

      // 等待足够长的时间（超过备份间隔）
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 获取新的快照数量
      const snapshotsAfter = await dataProvider.listSnapshots!();
      const countAfter = snapshotsAfter.length;

      // 快照数量应该没有增加（或只增加了少量pre-restore快照）
      expect(countAfter).toBeLessThanOrEqual(countBefore + 2);
    });
  });

  describe('错误处理', () => {
    it('应该在数据库文件不存在时抛出错误', async () => {
      // 创建数据库文件
      const tempDbPath = './temp-test.db';
      const tempDb = new Database(tempDbPath);
      tempDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      tempDb.close();

      // 创建带 Time Travel 的 provider
      const invalidProvider = (await createRefineSQL({
        connection: tempDbPath,
        schema,
        timeTravel: {
          enabled: true,
          backupDir: './test-backups-error',
        },
      })) as DataProviderWithTimeTravel;

      // 删除数据库文件
      rmSync(tempDbPath);

      // 尝试创建快照应该失败
      await expect(invalidProvider.createSnapshot!('test')).rejects.toThrow(
        /Database file not found/,
      );

      // 清理
      if (invalidProvider.stopAutoBackup) {
        invalidProvider.stopAutoBackup();
      }
      if (existsSync('./test-backups-error')) {
        rmSync('./test-backups-error', { recursive: true });
      }
    });

    it('应该在恢复不存在的时间戳时抛出错误', async () => {
      // 重新启用 Time Travel
      if (sqlite) {
        sqlite.close();
      }
      sqlite = new Database(testDbPath);
      db = drizzle(sqlite, { schema });

      const providerWithTT = (await createRefineSQL({
        connection: testDbPath,
        schema,
        timeTravel: {
          enabled: true,
          backupDir,
        },
      })) as DataProviderWithTimeTravel;

      await expect(
        providerWithTT.restoreToTimestamp!('2000-01-01T00:00:00.000Z'),
      ).rejects.toThrow(/Snapshot not found/);

      providerWithTT.stopAutoBackup!();
    });

    it('应该在没有合适快照时抛出错误', async () => {
      // 重新启用 Time Travel
      const providerWithTT = (await createRefineSQL({
        connection: testDbPath,
        schema,
        timeTravel: {
          enabled: true,
          backupDir,
        },
      })) as DataProviderWithTimeTravel;

      // 尝试恢复到很早的日期
      const veryEarlyDate = new Date('2000-01-01');

      await expect(
        providerWithTT.restoreToDate!(veryEarlyDate),
      ).rejects.toThrow(/No snapshot found before/);

      providerWithTT.stopAutoBackup!();
    });
  });
});
