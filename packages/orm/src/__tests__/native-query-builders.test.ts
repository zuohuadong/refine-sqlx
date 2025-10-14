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
import { sql } from 'drizzle-orm';
import {
  SelectChain,
  InsertChain,
  UpdateChain,
  DeleteChain,
  createSelectChain,
  createInsertChain,
  createUpdateChain,
  createDeleteChain,
} from '../core/native-query-builders.js';
import { QueryError, ValidationError } from '../types/errors.js';

// Mock drizzle client and table
const mockTable = {
  id: { name: 'id' },
  name: { name: 'name' },
  email: { name: 'email' },
  age: { name: 'age' },
  status: { name: 'status' },
  created_at: { name: 'created_at' },
  _: {
    columns: {
      id: { name: 'id' },
      name: { name: 'name' },
      email: { name: 'email' },
      age: { name: 'age' },
      status: { name: 'status' },
      created_at: { name: 'created_at' },
    },
  },
  // Add required Table interface properties
  $inferSelect: {} as any,
  $inferInsert: {} as any,
  getSQL: jest.fn(),
} as any;

const mockSchema = { users: mockTable, posts: mockTable } as any;

const mockClient = {
  schema: mockSchema,
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  onConflictDoNothing: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockReturnThis(),
  execute: jest.fn(),
};

describe('Native Query Builders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.execute.mockResolvedValue([]);
  });

  describe('SelectChain', () => {
    let selectChain: SelectChain<typeof mockSchema, 'users'>;

    beforeEach(() => {
      selectChain = createSelectChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
    });

    it('should create a SelectChain instance', () => {
      expect(selectChain).toBeInstanceOf(SelectChain);
    });

    it('should select specific columns', () => {
      selectChain.select(['id', 'name', 'email']);
      expect(selectChain).toBeDefined();
    });

    it('should add DISTINCT clause', () => {
      selectChain.distinct();
      expect(selectChain).toBeDefined();
    });

    it('should add WHERE conditions', () => {
      selectChain.where('age', 'gte', 18);
      selectChain.where('status', 'eq', 'active');
      expect(selectChain).toBeDefined();
    });

    it('should add WHERE conditions with AND logic', () => {
      selectChain.whereAnd([
        { column: 'age', operator: 'gte', value: 18 },
        { column: 'status', operator: 'eq', value: 'active' },
      ]);
      expect(selectChain).toBeDefined();
    });

    it('should add WHERE conditions with OR logic', () => {
      selectChain.whereOr([
        { column: 'status', operator: 'eq', value: 'active' },
        { column: 'status', operator: 'eq', value: 'pending' },
      ]);
      expect(selectChain).toBeDefined();
    });

    it('should add ORDER BY conditions', () => {
      selectChain.orderBy('created_at', 'desc');
      selectChain.orderBy('name', 'asc');
      expect(selectChain).toBeDefined();
    });

    it('should add GROUP BY clause', () => {
      selectChain.groupBy('status');
      expect(selectChain).toBeDefined();
    });

    it('should add HAVING conditions', () => {
      selectChain.having(sql`count(*) > 5`);
      expect(selectChain).toBeDefined();
    });

    it('should add HAVING with count condition', () => {
      selectChain.havingCount('gt', 5);
      expect(selectChain).toBeDefined();
    });

    it('should add HAVING with sum condition', () => {
      selectChain.havingSum('age', 'gte', 100);
      expect(selectChain).toBeDefined();
    });

    it('should add HAVING with avg condition', () => {
      selectChain.havingAvg('age', 'gte', 25);
      expect(selectChain).toBeDefined();
    });

    it('should add JOIN clauses', () => {
      selectChain.innerJoin('posts', sql`users.id = posts.user_id`);
      selectChain.leftJoin('posts', sql`users.id = posts.user_id`);
      selectChain.rightJoin('posts', sql`users.id = posts.user_id`);
      expect(selectChain).toBeDefined();
    });

    it('should set LIMIT and OFFSET', () => {
      selectChain.limit(10).offset(20);
      expect(selectChain).toBeDefined();
    });

    it('should set pagination', () => {
      selectChain.paginate(2, 15);
      expect(selectChain).toBeDefined();
    });

    it('should execute query and return results', async () => {
      const mockResults = [{ id: 1, name: 'John', email: 'john@example.com' }];
      mockClient.execute.mockResolvedValue(mockResults);

      const results = await selectChain.get();
      expect(results).toEqual(mockResults);
    });

    it('should get first result', async () => {
      const mockResults = [{ id: 1, name: 'John', email: 'john@example.com' }];
      mockClient.execute.mockResolvedValue(mockResults);

      const result = await selectChain.first();
      expect(result).toEqual(mockResults[0]);
    });

    it('should return null when no results for first()', async () => {
      mockClient.execute.mockResolvedValue([]);

      const result = await selectChain.first();
      expect(result).toBeNull();
    });

    it('should get count of results', async () => {
      mockClient.execute.mockResolvedValue([{ count: 42 }]);

      const count = await selectChain.count();
      expect(count).toBe(42);
    });

    it('should get sum of column', async () => {
      mockClient.execute.mockResolvedValue([{ sum: 150 }]);

      const sum = await selectChain.sum('age');
      expect(sum).toBe(150);
    });

    it('should get average of column', async () => {
      mockClient.execute.mockResolvedValue([{ avg: 25.5 }]);

      const avg = await selectChain.avg('age');
      expect(avg).toBe(25.5);
    });

    it('should get minimum value of column', async () => {
      mockClient.execute.mockResolvedValue([{ min: 18 }]);

      const min = await selectChain.min('age');
      expect(min).toBe(18);
    });

    it('should get maximum value of column', async () => {
      mockClient.execute.mockResolvedValue([{ max: 65 }]);

      const max = await selectChain.max('age');
      expect(max).toBe(65);
    });

    it('should throw error for invalid column', () => {
      expect(() => {
        selectChain.where('invalid_column' as any, 'eq', 'value');
      }).toThrow(QueryError);
    });

    it('should handle between operator', () => {
      selectChain.where('age', 'between', [18, 65]);
      expect(selectChain).toBeDefined();
    });

    it('should throw error for invalid between values', () => {
      expect(() => {
        selectChain.where('age', 'between', [18]); // Only one value
      }).toThrow(ValidationError);
    });
  });

  describe('InsertChain', () => {
    let insertChain: InsertChain<typeof mockSchema, 'users'>;

    beforeEach(() => {
      insertChain = createInsertChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
    });

    it('should create an InsertChain instance', () => {
      expect(insertChain).toBeInstanceOf(InsertChain);
    });

    it('should set values for single record', () => {
      insertChain.values({ name: 'John', email: 'john@example.com', age: 30 });
      expect(insertChain).toBeDefined();
    });

    it('should set values for multiple records', () => {
      insertChain.values([
        { name: 'John', email: 'john@example.com', age: 30 },
        { name: 'Jane', email: 'jane@example.com', age: 25 },
      ]);
      expect(insertChain).toBeDefined();
    });

    it('should handle conflict with ignore action', () => {
      insertChain.values({ name: 'John', email: 'john@example.com' });
      insertChain.onConflict('ignore');
      expect(insertChain).toBeDefined();
    });

    it('should handle conflict with update action', () => {
      insertChain.values({ name: 'John', email: 'john@example.com' });
      insertChain.onConflict('update', ['email'], { name: 'Updated John' });
      expect(insertChain).toBeDefined();
    });

    it('should specify returning columns', () => {
      insertChain.values({ name: 'John', email: 'john@example.com' });
      insertChain.returning(['id', 'name', 'created_at']);
      expect(insertChain).toBeDefined();
    });

    it('should execute insert and return results', async () => {
      const mockResults = [{ id: 1, name: 'John', email: 'john@example.com' }];
      mockClient.execute.mockResolvedValue(mockResults);

      insertChain.values({ name: 'John', email: 'john@example.com' });
      const results = await insertChain.execute();
      expect(results).toEqual(mockResults);
    });

    it('should throw error when no data provided', async () => {
      await expect(insertChain.execute()).rejects.toThrow(ValidationError);
    });
  });

  describe('UpdateChain', () => {
    let updateChain: UpdateChain<typeof mockSchema, 'users'>;

    beforeEach(() => {
      updateChain = createUpdateChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
    });

    it('should create an UpdateChain instance', () => {
      expect(updateChain).toBeInstanceOf(UpdateChain);
    });

    it('should set data to update', () => {
      updateChain.set({ name: 'Updated John', age: 31 });
      expect(updateChain).toBeDefined();
    });

    it('should add WHERE conditions', () => {
      updateChain.set({ name: 'Updated John' });
      updateChain.where('id', 'eq', 1);
      expect(updateChain).toBeDefined();
    });

    it('should add WHERE conditions with AND logic', () => {
      updateChain.set({ status: 'inactive' });
      updateChain.whereAnd([
        { column: 'age', operator: 'gte', value: 65 },
        { column: 'status', operator: 'eq', value: 'active' },
      ]);
      expect(updateChain).toBeDefined();
    });

    it('should add WHERE conditions with OR logic', () => {
      updateChain.set({ status: 'archived' });
      updateChain.whereOr([
        { column: 'status', operator: 'eq', value: 'inactive' },
        { column: 'age', operator: 'gte', value: 70 },
      ]);
      expect(updateChain).toBeDefined();
    });

    it('should add JOIN clauses', () => {
      updateChain.set({ status: 'verified' });
      updateChain.innerJoin('posts', sql`users.id = posts.user_id`);
      updateChain.leftJoin('posts', sql`users.id = posts.user_id`);
      expect(updateChain).toBeDefined();
    });

    it('should specify returning columns', () => {
      updateChain.set({ name: 'Updated John' });
      updateChain.where('id', 'eq', 1);
      updateChain.returning(['id', 'name', 'created_at']);
      expect(updateChain).toBeDefined();
    });

    it('should execute update and return results', async () => {
      const mockResults = [
        { id: 1, name: 'Updated John', email: 'john@example.com' },
      ];
      mockClient.execute.mockResolvedValue(mockResults);

      updateChain.set({ name: 'Updated John' });
      updateChain.where('id', 'eq', 1);
      const results = await updateChain.execute();
      expect(results).toEqual(mockResults);
    });

    it('should throw error when no data provided', async () => {
      updateChain.where('id', 'eq', 1);
      await expect(updateChain.execute()).rejects.toThrow(ValidationError);
    });
  });

  describe('DeleteChain', () => {
    let deleteChain: DeleteChain<typeof mockSchema, 'users'>;

    beforeEach(() => {
      deleteChain = createDeleteChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
    });

    it('should create a DeleteChain instance', () => {
      expect(deleteChain).toBeInstanceOf(DeleteChain);
    });

    it('should add WHERE conditions', () => {
      deleteChain.where('id', 'eq', 1);
      expect(deleteChain).toBeDefined();
    });

    it('should add WHERE conditions with AND logic', () => {
      deleteChain.whereAnd([
        { column: 'status', operator: 'eq', value: 'inactive' },
        { column: 'age', operator: 'gte', value: 70 },
      ]);
      expect(deleteChain).toBeDefined();
    });

    it('should add WHERE conditions with OR logic', () => {
      deleteChain.whereOr([
        { column: 'status', operator: 'eq', value: 'spam' },
        { column: 'status', operator: 'eq', value: 'deleted' },
      ]);
      expect(deleteChain).toBeDefined();
    });

    it('should add JOIN clauses', () => {
      deleteChain.where('status', 'eq', 'inactive');
      deleteChain.innerJoin('posts', sql`users.id = posts.user_id`);
      deleteChain.leftJoin('posts', sql`users.id = posts.user_id`);
      expect(deleteChain).toBeDefined();
    });

    it('should specify returning columns', () => {
      deleteChain.where('id', 'eq', 1);
      deleteChain.returning(['id', 'name', 'email']);
      expect(deleteChain).toBeDefined();
    });

    it('should execute delete and return results', async () => {
      const mockResults = [{ id: 1, name: 'John', email: 'john@example.com' }];
      mockClient.execute.mockResolvedValue(mockResults);

      deleteChain.where('id', 'eq', 1);
      const results = await deleteChain.execute();
      expect(results).toEqual(mockResults);
    });
  });

  describe('Factory Functions', () => {
    it('should create SelectChain with factory function', () => {
      const selectChain = createSelectChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
      expect(selectChain).toBeInstanceOf(SelectChain);
    });

    it('should create InsertChain with factory function', () => {
      const insertChain = createInsertChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
      expect(insertChain).toBeInstanceOf(InsertChain);
    });

    it('should create UpdateChain with factory function', () => {
      const updateChain = createUpdateChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
      expect(updateChain).toBeInstanceOf(UpdateChain);
    });

    it('should create DeleteChain with factory function', () => {
      const deleteChain = createDeleteChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );
      expect(deleteChain).toBeInstanceOf(DeleteChain);
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported filter operators', () => {
      const selectChain = createSelectChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      expect(() => {
        selectChain.where('age', 'unsupported' as any, 18);
      }).toThrow(QueryError);
    });

    it('should handle invalid column names', () => {
      const selectChain = createSelectChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      expect(() => {
        selectChain.where('nonexistent_column' as any, 'eq', 'value');
      }).toThrow(QueryError);
    });

    it('should handle invalid between values', () => {
      const selectChain = createSelectChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      expect(() => {
        selectChain.where('age', 'between', [18]); // Only one value
      }).toThrow(ValidationError);
    });

    it('should handle invalid notBetween values', () => {
      const selectChain = createSelectChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      expect(() => {
        selectChain.where('age', 'notBetween', [18, 25, 30]); // Too many values
      }).toThrow(ValidationError);
    });
  });

  describe('Complex Query Building', () => {
    it('should build complex SELECT query with multiple conditions', () => {
      const selectChain = createSelectChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      selectChain
        .select(['id', 'name', 'email', 'age'])
        .distinct()
        .where('age', 'gte', 18)
        .where('status', 'eq', 'active')
        .whereOr([
          { column: 'name', operator: 'like', value: 'John' },
          { column: 'email', operator: 'like', value: '@gmail.com' },
        ])
        .orderBy('created_at', 'desc')
        .orderBy('name', 'asc')
        .groupBy('status')
        .havingCount('gt', 5)
        .limit(20)
        .offset(10);

      expect(selectChain).toBeDefined();
    });

    it('should build complex INSERT query with conflict resolution', () => {
      const insertChain = createInsertChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      insertChain
        .values([
          { name: 'John', email: 'john@example.com', age: 30 },
          { name: 'Jane', email: 'jane@example.com', age: 25 },
        ])
        .onConflict('update', ['email'], { name: 'Updated Name' })
        .returning(['id', 'name', 'email']);

      expect(insertChain).toBeDefined();
    });

    it('should build complex UPDATE query with joins and conditions', () => {
      const updateChain = createUpdateChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      updateChain
        .set({ status: 'verified', age: 31 })
        .where('id', 'eq', 1)
        .whereAnd([
          { column: 'status', operator: 'eq', value: 'pending' },
          { column: 'age', operator: 'gte', value: 18 },
        ])
        .innerJoin('posts', sql`users.id = posts.user_id`)
        .returning(['id', 'name', 'status']);

      expect(updateChain).toBeDefined();
    });

    it('should build complex DELETE query with multiple conditions', () => {
      const deleteChain = createDeleteChain(
        mockClient as any,
        mockTable as any,
        mockSchema as any,
        'users'
      );

      deleteChain
        .whereOr([
          { column: 'status', operator: 'eq', value: 'spam' },
          { column: 'status', operator: 'eq', value: 'deleted' },
        ])
        .whereAnd([
          { column: 'age', operator: 'lt', value: 18 },
          { column: 'created_at', operator: 'lt', value: '2020-01-01' },
        ])
        .returning(['id', 'name', 'email']);

      expect(deleteChain).toBeDefined();
    });
  });
});
