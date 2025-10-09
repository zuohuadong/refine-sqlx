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
import { RelationshipQueryBuilder } from '../core/relationship-query-builder';
import type { RelationshipConfig } from '../core/relationship-query-builder';
import type { DrizzleClient } from '../types/client';

// Mock functions for drizzle-orm
const mockEq = (col: any, val: any) => ({
  type: 'eq',
  column: col,
  value: val,
});
const mockInArray = (col: any, vals: any) => ({
  type: 'inArray',
  column: col,
  values: vals,
});
const mockAnd = (...conditions: any[]) => ({ type: 'and', conditions });
const mockOr = (...conditions: any[]) => ({ type: 'or', conditions });

describe('RelationshipQueryBuilder', () => {
  let mockClient: DrizzleClient<any>;
  let mockSchema: any;
  let relationshipBuilder: RelationshipQueryBuilder<any>;

  beforeEach(() => {
    // Mock schema with tables
    mockSchema = {
      users: {
        id: { name: 'id' },
        name: { name: 'name' },
        email: { name: 'email' },
        _: {
          columns: {
            id: { name: 'id' },
            name: { name: 'name' },
            email: { name: 'email' },
          },
        },
      },
      posts: {
        id: { name: 'id' },
        title: { name: 'title' },
        user_id: { name: 'user_id' },
        _: {
          columns: {
            id: { name: 'id' },
            title: { name: 'title' },
            user_id: { name: 'user_id' },
          },
        },
      },
      comments: {
        id: { name: 'id' },
        content: { name: 'content' },
        post_id: { name: 'post_id' },
        user_id: { name: 'user_id' },
        _: {
          columns: {
            id: { name: 'id' },
            content: { name: 'content' },
            post_id: { name: 'post_id' },
            user_id: { name: 'user_id' },
          },
        },
      },
      user_roles: {
        user_id: { name: 'user_id' },
        role_id: { name: 'role_id' },
        _: {
          columns: {
            user_id: { name: 'user_id' },
            role_id: { name: 'role_id' },
          },
        },
      },
      roles: {
        id: { name: 'id' },
        name: { name: 'name' },
        _: { columns: { id: { name: 'id' }, name: { name: 'name' } } },
      },
      profiles: {
        id: { name: 'id' },
        bio: { name: 'bio' },
        user_id: { name: 'user_id' },
        _: {
          columns: {
            id: { name: 'id' },
            bio: { name: 'bio' },
            user_id: { name: 'user_id' },
          },
        },
      },
    };

    // Mock client with table-specific data
    const mockData = {
      users: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ],
      posts: [
        { id: 1, title: 'Test Post', user_id: 1 },
        { id: 2, title: 'Another Post', user_id: 1 },
        { id: 3, title: 'Jane Post', user_id: 2 },
      ],
      comments: [
        { id: 1, content: 'Great post!', post_id: 1, user_id: 2 },
        { id: 2, content: 'Thanks!', post_id: 1, user_id: 1 },
      ],
      roles: [
        { id: 1, name: 'Admin' },
        { id: 2, name: 'User' },
      ],
      user_roles: [
        { user_id: 1, role_id: 1 },
        { user_id: 1, role_id: 2 },
        { user_id: 2, role_id: 2 },
      ],
      profiles: [
        { id: 1, bio: 'Software developer', user_id: 1 },
        { id: 2, bio: 'Designer', user_id: 2 },
      ],
    };

    // Simple mock that tracks query context
    let mockQueryContext: {
      table?: string;
      whereColumn?: string;
      whereValue?: any;
    } = {};

    mockClient = {
      schema: mockSchema,
      select: () => ({
        from: (table: any) => {
          // Determine table name from the table object
          mockQueryContext.table = Object.keys(mockSchema).find(
            key => mockSchema[key] === table
          );

          return {
            where: (condition: any) => {
              // For the mock, we'll intercept this and use a simpler approach
              // The actual implementation will be handled in executeRelationshipQuery
              return Promise.resolve([]);
            },
          };
        },
      }),
      insert: () => ({}),
      update: () => ({}),
      delete: () => ({}),
      execute: () => Promise.resolve([]),
      transaction: () => Promise.resolve(),
    } as any;

    relationshipBuilder = new RelationshipQueryBuilder(mockClient, mockSchema);

    // Override executeRelationshipQuery for testing
    (relationshipBuilder as any).executeRelationshipQuery = async (
      tableName: string,
      columnName: string,
      value: any
    ) => {
      const data = mockData[tableName as keyof typeof mockData] || [];

      if (!columnName || value === undefined) {
        return data;
      }

      return (data as any[]).filter((record: any) => {
        return record[columnName] === value;
      });
    };
  });

  describe('loadRelationshipsForRecord', () => {
    it('should load hasOne relationship', async () => {
      const user = { id: 1, name: 'John Doe', email: 'john@example.com' };

      const relationships: Record<string, RelationshipConfig<any>> = {
        profile: {
          type: 'hasOne',
          relatedTable: 'profiles',
          localKey: 'id',
          relatedKey: 'user_id',
        },
      };

      const result = await relationshipBuilder.loadRelationshipsForRecord(
        'users',
        user,
        relationships
      );

      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        profile: { id: 1, bio: 'Software developer', user_id: 1 },
      });
    });

    it('should load hasMany relationship', async () => {
      const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
      const relationships: Record<string, RelationshipConfig<any>> = {
        posts: {
          type: 'hasMany',
          relatedTable: 'posts',
          localKey: 'id',
          relatedKey: 'user_id',
        },
      };

      const result = await relationshipBuilder.loadRelationshipsForRecord(
        'users',
        user,
        relationships
      );

      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        posts: [
          { id: 1, title: 'Test Post', user_id: 1 },
          { id: 2, title: 'Another Post', user_id: 1 },
        ],
      });
    });

    it('should load belongsTo relationship', async () => {
      const post = { id: 1, title: 'Test Post', user_id: 1 };
      const relationships: Record<string, RelationshipConfig<any>> = {
        user: {
          type: 'belongsTo',
          relatedTable: 'users',
          foreignKey: 'user_id',
          relatedKey: 'id',
        },
      };

      const result = await relationshipBuilder.loadRelationshipsForRecord(
        'posts',
        post,
        relationships
      );

      expect(result).toEqual({
        id: 1,
        title: 'Test Post',
        user_id: 1,
        user: { id: 1, name: 'John Doe', email: 'john@example.com' },
      });
    });

    it('should load belongsToMany relationship', async () => {
      const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
      const relationships: Record<string, RelationshipConfig<any>> = {
        roles: {
          type: 'belongsToMany',
          relatedTable: 'roles',
          pivotTable: 'user_roles',
          localKey: 'id',
          relatedKey: 'id',
          pivotLocalKey: 'user_id',
          pivotRelatedKey: 'role_id',
        },
      };

      // Mock the pivot query result
      const mockPivotQuery = {
        where: () =>
          Promise.resolve([
            { user_id: 1, role_id: 1 },
            { user_id: 1, role_id: 2 },
          ]),
      };

      // Mock the roles query result
      const mockRolesQuery = {
        where: () =>
          Promise.resolve([
            { id: 1, name: 'Admin' },
            { id: 2, name: 'User' },
          ]),
      };

      let callCount = 0;
      mockClient.select = () => ({
        from: () => {
          callCount++;
          return callCount === 1 ? mockPivotQuery : mockRolesQuery;
        },
      });

      const result = await relationshipBuilder.loadRelationshipsForRecord(
        'users',
        user,
        relationships
      );

      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        roles: [
          { id: 1, name: 'Admin' },
          { id: 2, name: 'User' },
        ],
      });
    });
  });

  describe('loadRelationshipsForRecords', () => {
    it('should load relationships for multiple records efficiently', async () => {
      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ];

      const relationships: Record<string, RelationshipConfig<any>> = {
        posts: {
          type: 'hasMany',
          relatedTable: 'posts',
          localKey: 'id',
          relatedKey: 'user_id',
        },
      };

      const results = await relationshipBuilder.loadRelationshipsForRecords(
        'users',
        users,
        relationships
      );

      expect(results).toEqual([
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          posts: [
            { id: 1, title: 'Test Post', user_id: 1 },
            { id: 2, title: 'Another Post', user_id: 1 },
          ],
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          posts: [{ id: 3, title: 'Jane Post', user_id: 2 }],
        },
      ]);
    });

    it('should handle empty records array', async () => {
      const relationships: Record<string, RelationshipConfig<any>> = {
        posts: {
          type: 'hasMany',
          relatedTable: 'posts',
          localKey: 'id',
          relatedKey: 'user_id',
        },
      };

      const results = await relationshipBuilder.loadRelationshipsForRecords(
        'users',
        [],
        relationships
      );

      expect(results).toEqual([]);
    });

    it('should handle failed relationship loading gracefully', async () => {
      const users = [{ id: 3, name: 'Test User', email: 'test@example.com' }];

      const relationships: Record<string, RelationshipConfig<any>> = {
        posts: {
          type: 'hasMany',
          relatedTable: 'posts',
          localKey: 'id',
          relatedKey: 'user_id',
        },
      };

      // Create a new relationshipBuilder instance with error-throwing executeRelationshipQuery
      const errorBuilder = new RelationshipQueryBuilder(mockClient, mockSchema);
      (errorBuilder as any).executeRelationshipQuery = () =>
        Promise.reject(new Error('Database error'));

      const results = await errorBuilder.loadRelationshipsForRecords(
        'users',
        users,
        relationships
      );

      expect(results).toEqual([
        {
          id: 3,
          name: 'Test User',
          email: 'test@example.com',
          posts: [], // Should default to empty array for hasMany
        },
      ]);
    });
  });

  describe('error handling', () => {
    it('should handle unsupported relationship type gracefully', async () => {
      const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
      const relationships: Record<string, RelationshipConfig<any>> = {
        invalid: { type: 'unsupported' as any, relatedTable: 'posts' },
      };

      const result = await relationshipBuilder.loadRelationshipsForRecord(
        'users',
        user,
        relationships
      );

      // Should return user with null relationship due to graceful error handling
      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        invalid: null,
      });
    });

    it('should handle belongsToMany without pivot table gracefully', async () => {
      const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
      const relationships: Record<string, RelationshipConfig<any>> = {
        roles: {
          type: 'belongsToMany',
          relatedTable: 'roles',
          // Missing pivotTable
        },
      };

      const result = await relationshipBuilder.loadRelationshipsForRecord(
        'users',
        user,
        relationships
      );

      // Should return user with empty array due to graceful error handling
      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        roles: [],
      });
    });

    it('should handle missing related table gracefully', async () => {
      const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
      const relationships: Record<string, RelationshipConfig<any>> = {
        invalid: { type: 'hasOne', relatedTable: 'nonexistent' },
      };

      const result = await relationshipBuilder.loadRelationshipsForRecord(
        'users',
        user,
        relationships
      );

      // Should return user with null relationship due to graceful error handling
      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        invalid: null,
      });
    });
  });
});
