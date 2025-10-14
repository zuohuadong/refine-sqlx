import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
  test,
} from './test-utils.js';
import {
  createCloudflareD1Adapter,
  createBunSQLiteAdapter,
  createNodeSQLiteAdapter,
  createBetterSQLite3Adapter,
} from '../src/adapters';
import type { SqlQuery } from '../src/client';

// Mock implementations
const mockD1 = { prepare: jest.fn(), batch: jest.fn() };

const mockBunDB = { prepare: jest.fn() };

const mockNodeDB = { prepare: jest.fn() };

const mockBetterSQLite3DB = { prepare: jest.fn() };

describe('Cloudflare D1 Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query data correctly', async () => {
    const mockStmt = {
      bind: jest.fn().mockReturnThis(),
      raw: jest.fn().mockResolvedValue([
        ['id', 'name'], // column names
        [1, 'John'], // first row
        [2, 'Jane'], // second row
      ]),
    };
    mockD1.prepare.mockReturnValue(mockStmt);

    const client = createCloudflareD1Adapter(mockD1 as any);
    const query: SqlQuery = { sql: 'SELECT * FROM users', args: [] };

    const result = await client.query(query);

    expect(result).toEqual({
      columnNames: ['id', 'name'],
      rows: [
        [1, 'John'],
        [2, 'Jane'],
      ],
    });
    expect(mockD1.prepare).toHaveBeenCalledWith(query.sql);
    expect(mockStmt.bind).toHaveBeenCalledWith(query.args);
    expect(mockStmt.raw).toHaveBeenCalledWith({ columnNames: true });
  });

  it('should execute queries correctly', async () => {
    const mockStmt = {
      bind: jest.fn().mockReturnThis(),
      run: jest
        .fn()
        .mockResolvedValue({ meta: { changes: 1, last_row_id: 123 } }),
    };
    mockD1.prepare.mockReturnValue(mockStmt);

    const client = createCloudflareD1Adapter(mockD1 as any);
    const query: SqlQuery = {
      sql: 'INSERT INTO users (name) VALUES (?)',
      args: ['John'],
    };

    const result = await client.execute(query);

    expect(result).toEqual({ changes: 1, lastInsertId: 123 });
    expect(mockD1.prepare).toHaveBeenCalledWith(query.sql);
    expect(mockStmt.bind).toHaveBeenCalledWith(query.args);
  });

  it('should handle batch operations', async () => {
    const mockStmt = { bind: jest.fn().mockReturnThis() };
    mockD1.prepare.mockReturnValue(mockStmt);
    mockD1.batch.mockResolvedValue([
      { success: true, meta: { changes: 1, last_row_id: 1 } },
      {
        success: true,
        meta: { columns: ['id', 'name'], changes: 0 },
        results: [[1, 'John']],
      },
    ]);

    const client = createCloudflareD1Adapter(mockD1 as any);
    const queries: SqlQuery[] = [
      { sql: 'INSERT INTO users (name) VALUES (?)', args: ['John'] },
      { sql: 'SELECT * FROM users WHERE id = ?', args: [1] },
    ];

    const results = await client.batch!(queries);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ changes: 1, lastInsertId: 1 });
    expect(results[1]).toEqual({
      columnNames: ['id', 'name'],
      rows: [[1, 'John']],
    });
  });

  it('should handle batch failures', async () => {
    const mockStmt = { bind: jest.fn().mockReturnThis() };
    mockD1.prepare.mockReturnValue(mockStmt);
    mockD1.batch.mockResolvedValue([{ success: false, error: 'Syntax error' }]);

    const client = createCloudflareD1Adapter(mockD1 as any);
    const queries: SqlQuery[] = [{ sql: 'INVALID SQL', args: [] }];

    await expect(client.batch!(queries)).rejects.toThrow(
      'Batch query failed: Syntax error'
    );
  });
});

describe('Bun SQLite Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query data correctly', async () => {
    const mockStmt = {
      values: jest.fn().mockReturnValue([
        [1, 'John'],
        [2, 'Jane'],
      ]),
      columnNames: ['id', 'name'],
    };
    mockBunDB.prepare.mockReturnValue(mockStmt);

    const client = createBunSQLiteAdapter(mockBunDB as any);
    const query: SqlQuery = { sql: 'SELECT * FROM users', args: [] };

    const result = await client.query(query);

    expect(result).toEqual({
      columnNames: ['id', 'name'],
      rows: [
        [1, 'John'],
        [2, 'Jane'],
      ],
    });
  });

  it('should execute queries correctly', async () => {
    const mockStmt = {
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 123 }),
    };
    mockBunDB.prepare.mockReturnValue(mockStmt);

    const client = createBunSQLiteAdapter(mockBunDB as any);
    const query: SqlQuery = {
      sql: 'INSERT INTO users (name) VALUES (?)',
      args: ['John'],
    };

    const result = await client.execute(query);

    expect(result).toEqual({ changes: 1, lastInsertId: 123 });
  });

  it('should handle transactions', async () => {
    const mockStmt = {
      run: jest
        .fn()
        .mockReturnValueOnce({ changes: 0 }) // BEGIN
        .mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 }) // INSERT
        .mockReturnValueOnce({ changes: 0 }), // COMMIT
    };
    mockBunDB.prepare.mockReturnValue(mockStmt);

    const client = createBunSQLiteAdapter(mockBunDB as any);

    const result = await client.transaction!(async tx => {
      await tx.execute({
        sql: 'INSERT INTO users (name) VALUES (?)',
        args: ['John'],
      });
      return 'success';
    });

    expect(result).toBe('success');
    expect(mockBunDB.prepare).toHaveBeenCalledWith('BEGIN');
    expect(mockBunDB.prepare).toHaveBeenCalledWith('COMMIT');
  });

  it('should rollback on transaction failure', async () => {
    const mockStmt = {
      run: jest
        .fn()
        .mockReturnValueOnce({ changes: 0 }) // BEGIN
        .mockImplementationOnce(() => {
          throw new Error('DB Error');
        }) // INSERT fails
        .mockReturnValueOnce({ changes: 0 }), // ROLLBACK
    };
    mockBunDB.prepare.mockReturnValue(mockStmt);

    const client = createBunSQLiteAdapter(mockBunDB as any);

    await expect(
      client.transaction!(async tx => {
        await tx.execute({
          sql: 'INSERT INTO users (name) VALUES (?)',
          args: ['John'],
        });
        return 'success';
      })
    ).rejects.toThrow('DB Error');

    expect(mockBunDB.prepare).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('Node SQLite Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query data correctly', async () => {
    const mockStmt = {
      all: jest.fn().mockReturnValue([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ]),
      columns: jest
        .fn()
        .mockReturnValue([{ column: 'id' }, { column: 'name' }]),
    };
    mockNodeDB.prepare.mockReturnValue(mockStmt);

    const client = createNodeSQLiteAdapter(mockNodeDB as any);
    const query: SqlQuery = { sql: 'SELECT * FROM users', args: [] };

    const result = await client.query(query);

    expect(result).toEqual({
      columnNames: ['id', 'name'],
      rows: [
        [1, 'John'],
        [2, 'Jane'],
      ],
    });
  });

  it('should execute queries correctly', async () => {
    const mockStmt = {
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 123 }),
    };
    mockNodeDB.prepare.mockReturnValue(mockStmt);

    const client = createNodeSQLiteAdapter(mockNodeDB as any);
    const query: SqlQuery = {
      sql: 'INSERT INTO users (name) VALUES (?)',
      args: ['John'],
    };

    const result = await client.execute(query);

    expect(result).toEqual({ changes: 1, lastInsertId: 123 });
  });

  it('should handle transactions', async () => {
    const mockStmt = {
      run: jest
        .fn()
        .mockReturnValueOnce({ changes: 0 }) // BEGIN
        .mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 }) // INSERT
        .mockReturnValueOnce({ changes: 0 }), // COMMIT
    };
    mockNodeDB.prepare.mockReturnValue(mockStmt);

    const client = createNodeSQLiteAdapter(mockNodeDB as any);

    const result = await client.transaction!(async tx => {
      await tx.execute({
        sql: 'INSERT INTO users (name) VALUES (?)',
        args: ['John'],
      });
      return 'success';
    });

    expect(result).toBe('success');
    expect(mockNodeDB.prepare).toHaveBeenCalledWith('BEGIN');
    expect(mockNodeDB.prepare).toHaveBeenCalledWith('COMMIT');
  });
});

describe('better-sqlite3 Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query data correctly', async () => {
    const mockRawStmt = {
      all: jest.fn().mockReturnValue([
        [1, 'John'],
        [2, 'Jane'],
      ]),
    };
    const mockStmt = {
      bind: jest.fn().mockReturnThis(),
      columns: jest.fn().mockReturnValue([{ name: 'id' }, { name: 'name' }]),
      raw: jest.fn().mockReturnValue(mockRawStmt),
    };
    mockBetterSQLite3DB.prepare.mockReturnValue(mockStmt);

    const client = createBetterSQLite3Adapter(mockBetterSQLite3DB as any);
    const query: SqlQuery = { sql: 'SELECT * FROM users', args: [] };

    const result = await client.query(query);

    expect(result).toEqual({
      columnNames: ['id', 'name'],
      rows: [
        [1, 'John'],
        [2, 'Jane'],
      ],
    });
    expect(mockStmt.bind).toHaveBeenCalledWith(...query.args);
  });

  it('should execute queries correctly', async () => {
    const mockStmt = {
      bind: jest.fn().mockReturnThis(),
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 123 }),
    };
    mockBetterSQLite3DB.prepare.mockReturnValue(mockStmt);

    const client = createBetterSQLite3Adapter(mockBetterSQLite3DB as any);
    const query: SqlQuery = {
      sql: 'INSERT INTO users (name) VALUES (?)',
      args: ['John'],
    };

    const result = await client.execute(query);

    expect(result).toEqual({ changes: 1, lastInsertId: 123 });
    expect(mockStmt.bind).toHaveBeenCalledWith(...query.args);
  });

  it('should handle transactions', async () => {
    const mockStmt = {
      bind: jest.fn().mockReturnThis(),
      run: jest
        .fn()
        .mockReturnValueOnce({ changes: 0 }) // BEGIN
        .mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 }) // INSERT
        .mockReturnValueOnce({ changes: 0 }), // COMMIT
    };
    mockBetterSQLite3DB.prepare.mockReturnValue(mockStmt);

    const client = createBetterSQLite3Adapter(mockBetterSQLite3DB as any);

    const result = await client.transaction!(async tx => {
      await tx.execute({
        sql: 'INSERT INTO users (name) VALUES (?)',
        args: ['John'],
      });
      return 'success';
    });

    expect(result).toBe('success');
    expect(mockBetterSQLite3DB.prepare).toHaveBeenCalledWith('BEGIN');
    expect(mockBetterSQLite3DB.prepare).toHaveBeenCalledWith('COMMIT');
  });
});
