import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest, test } from './test-utils.js';
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import {
  MorphQueryBuilder,
  createMorphQuery,
  EnhancedMorphQueryBuilder,
} from '../core/morph-query';
import type {
  DrizzleClient,
  MorphConfig,
  EnhancedMorphConfig,
} from '../types/client';
import {
  createMorphConfig,
  createEnhancedMorphConfig,
  validateMorphConfig,
  validateEnhancedMorphConfig,
  getMorphTypeNames,
  isValidMorphType,
} from '../utils/morph-helpers';

// Test schema for polymorphic relationships
const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  morphable_type: text('morphable_type').notNull(),
  morphable_id: integer('morphable_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Pivot table for many-to-many polymorphic relationships
const taggables = pgTable('taggables', {
  id: serial('id').primaryKey(),
  tag_id: integer('tag_id').notNull(),
  taggable_type: text('taggable_type').notNull(),
  taggable_id: integer('taggable_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { comments, posts, videos, users, taggables, tags };

// Create a chainable mock query object
const createChainableMock = (finalResult: any) => {
  const chainable = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(finalResult),
  };

  // Make all methods return the chainable object
  Object.keys(chainable).forEach(key => {
    if (key !== 'execute') {
      (chainable as any)[key].mockReturnValue(chainable);
    }
  });

  return chainable;
};

// Mock drizzle client
const mockClient: DrizzleClient<typeof schema> = {
  schema,
  select: jest.fn().mockImplementation(fields => {
    if (fields && fields.count) {
      // Count query
      return createChainableMock([{ count: 2 }]);
    } else {
      // Regular select query
      return createChainableMock([
        {
          id: 1,
          content: 'Great post!',
          morphable_type: 'post',
          morphable_id: 1,
          createdAt: new Date(),
        },
        {
          id: 2,
          content: 'Nice video!',
          morphable_type: 'video',
          morphable_id: 1,
          createdAt: new Date(),
        },
      ]);
    }
  }),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
};

// Morph configuration
const morphConfig: MorphConfig<typeof schema> = {
  typeField: 'morphable_type',
  idField: 'morphable_id',
  relationName: 'morphable',
  types: { post: 'posts', video: 'videos' },
};

describe('Morph Query Builder', () => {
  it('should create morph query builder instance', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );
    expect(morphQuery).toBeDefined();
  });

  it('should create morph query using factory function', () => {
    const morphQuery = createMorphQuery(
      mockClient,
      'comments',
      morphConfig,
      schema
    );
    expect(morphQuery).toBeDefined();
  });

  it('should support method chaining', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    const result = morphQuery
      .where('id', 'eq', 1)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .offset(0);

    expect(result).toBe(morphQuery); // Should return same instance for chaining
  });

  it('should support paginate method', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    const result = morphQuery.paginate(1, 10);

    expect(result).toBe(morphQuery); // Should return same instance for chaining
  });

  it('should support whereType method', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    const result = morphQuery.whereType('post');

    expect(result).toBe(morphQuery);
  });

  it('should support whereTypeIn method', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    const result = morphQuery.whereTypeIn(['post', 'video']);

    expect(result).toBe(morphQuery);
  });

  it('should throw error for invalid morph type in whereType', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    expect(() => {
      morphQuery.whereType('invalid');
    }).toThrow("Morph type 'invalid' is not defined in configuration");
  });

  it('should throw error for invalid morph types in whereTypeIn', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    expect(() => {
      morphQuery.whereTypeIn(['post', 'invalid']);
    }).toThrow('Invalid morph types: invalid');
  });

  it('should support pagination', () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    const result = morphQuery.paginate(1, 10);

    expect(result).toBe(morphQuery);
  });

  it('should execute get method and load polymorphic relationships', async () => {
    // Mock the related data queries
    const mockClientWithRelations = {
      ...mockClient,
      select: jest.fn().mockImplementation(fields => {
        if (fields && fields.count) {
          // Count query
          return createChainableMock([{ count: 2 }]);
        } else {
          // Regular select query
          return {
            from: jest.fn().mockImplementation(table => {
              if (table === posts) {
                // Posts query
                return createChainableMock([
                  {
                    id: 1,
                    title: 'Test Post',
                    content: 'Post content',
                    createdAt: new Date(),
                  },
                ]);
              } else if (table === videos) {
                // Videos query
                return createChainableMock([
                  {
                    id: 1,
                    title: 'Test Video',
                    url: 'http://example.com/video',
                    createdAt: new Date(),
                  },
                ]);
              } else {
                // Comments query (base query)
                return createChainableMock([
                  {
                    id: 1,
                    content: 'Great post!',
                    morphable_type: 'post',
                    morphable_id: 1,
                    createdAt: new Date(),
                  },
                  {
                    id: 2,
                    content: 'Nice video!',
                    morphable_type: 'video',
                    morphable_id: 1,
                    createdAt: new Date(),
                  },
                ]);
              }
            }),
          };
        }
      }),
    };

    const morphQuery = new MorphQueryBuilder(
      mockClientWithRelations,
      'comments',
      morphConfig,
      schema
    );

    const results = await morphQuery.get();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);

    // Check that polymorphic relationships are loaded
    expect(results[0]).toHaveProperty('morphable');
    expect(results[1]).toHaveProperty('morphable');
  });

  it('should execute first method', async () => {
    const morphQuery = new MorphQueryBuilder(
      mockClient,
      'comments',
      morphConfig,
      schema
    );

    const result = await morphQuery.first();

    expect(result).toBeDefined();
  });

  it('should execute count method', async () => {
    // Mock count query
    const countMockClient = {
      ...mockClient,
      select: jest
        .fn()
        .mockReturnValue({
          from: jest
            .fn()
            .mockReturnValue({
              where: jest
                .fn()
                .mockReturnValue({
                  execute: jest.fn().mockResolvedValue([{ count: 5 }]),
                }),
              execute: jest.fn().mockResolvedValue([{ count: 5 }]),
            }),
        }),
    };

    const morphQuery = new MorphQueryBuilder(
      countMockClient,
      'comments',
      morphConfig,
      schema
    );

    const result = await morphQuery.count();

    expect(typeof result).toBe('number');
    expect(result).toBe(5);
  });

  it('should handle empty results gracefully', async () => {
    const emptyMockClient = {
      ...mockClient,
      select: jest
        .fn()
        .mockReturnValue({
          from: jest
            .fn()
            .mockReturnValue({
              where: jest
                .fn()
                .mockReturnValue({
                  orderBy: jest
                    .fn()
                    .mockReturnValue({
                      limit: jest
                        .fn()
                        .mockReturnValue({
                          offset: jest
                            .fn()
                            .mockReturnValue({
                              execute: jest.fn().mockResolvedValue([]),
                            }),
                        }),
                    }),
                }),
              execute: jest.fn().mockResolvedValue([]),
            }),
        }),
    };

    const morphQuery = new MorphQueryBuilder(
      emptyMockClient,
      'comments',
      morphConfig,
      schema
    );

    const results = await morphQuery.get();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const errorMockClient = {
      ...mockClient,
      select: jest
        .fn()
        .mockReturnValue({
          from: jest
            .fn()
            .mockReturnValue({
              execute: jest.fn().mockRejectedValue(new Error('Database error')),
            }),
        }),
    };

    const morphQuery = new MorphQueryBuilder(
      errorMockClient,
      'comments',
      morphConfig,
      schema
    );

    await expect(morphQuery.get()).rejects.toThrow(
      'Failed to execute polymorphic query'
    );
  });
});

describe('Enhanced Morph Query Builder', () => {
  const enhancedMorphConfig: EnhancedMorphConfig<typeof schema> = {
    typeField: 'taggable_type',
    idField: 'taggable_id',
    relationName: 'taggable',
    types: { post: 'posts', video: 'videos', user: 'users' },
    pivotTable: 'taggables',
    pivotLocalKey: 'tag_id',
    pivotForeignKey: 'taggable_id',
    nested: true,
    nestedRelations: {
      comments: {
        typeField: 'morphable_type',
        idField: 'morphable_id',
        relationName: 'comments',
        types: { post: 'posts', video: 'videos' },
      },
    },
  };

  it('should create enhanced morph query builder instance', () => {
    const enhancedMorphQuery = new EnhancedMorphQueryBuilder(
      mockClient,
      'tags',
      enhancedMorphConfig,
      schema
    );
    expect(enhancedMorphQuery).toBeDefined();
  });

  it('should support many-to-many polymorphic relationships', async () => {
    const manyToManyMockClient = {
      ...mockClient,
      select: jest.fn().mockImplementation(fields => {
        if (fields && fields.count) {
          return {
            from: jest
              .fn()
              .mockReturnValue({
                execute: jest.fn().mockResolvedValue([{ count: 2 }]),
              }),
          };
        } else {
          return {
            from: jest.fn().mockImplementation(table => {
              if (table === taggables) {
                // Pivot table query
                return {
                  where: jest.fn().mockReturnValue({
                    execute: jest.fn().mockResolvedValue([
                      {
                        id: 1,
                        tag_id: 1,
                        taggable_type: 'post',
                        taggable_id: 1,
                      },
                      {
                        id: 2,
                        tag_id: 1,
                        taggable_type: 'video',
                        taggable_id: 1,
                      },
                    ]),
                  }),
                };
              } else if (table === posts) {
                return {
                  where: jest
                    .fn()
                    .mockReturnValue({
                      execute: jest
                        .fn()
                        .mockResolvedValue([
                          {
                            id: 1,
                            title: 'Test Post',
                            content: 'Post content',
                          },
                        ]),
                    }),
                };
              } else if (table === videos) {
                return {
                  where: jest
                    .fn()
                    .mockReturnValue({
                      execute: jest
                        .fn()
                        .mockResolvedValue([
                          {
                            id: 1,
                            title: 'Test Video',
                            url: 'http://example.com/video',
                          },
                        ]),
                    }),
                };
              } else {
                // Base query for tags
                return {
                  where: jest
                    .fn()
                    .mockReturnValue({
                      orderBy: jest
                        .fn()
                        .mockReturnValue({
                          limit: jest
                            .fn()
                            .mockReturnValue({
                              offset: jest
                                .fn()
                                .mockReturnValue({
                                  execute: jest
                                    .fn()
                                    .mockResolvedValue([
                                      {
                                        id: 1,
                                        name: 'Technology',
                                        createdAt: new Date(),
                                      },
                                    ]),
                                }),
                            }),
                        }),
                    }),
                  execute: jest
                    .fn()
                    .mockResolvedValue([
                      { id: 1, name: 'Technology', createdAt: new Date() },
                    ]),
                };
              }
            }),
          };
        }
      }),
    };

    const enhancedMorphQuery = new EnhancedMorphQueryBuilder(
      manyToManyMockClient,
      'tags',
      enhancedMorphConfig,
      schema
    );

    const results = await enhancedMorphQuery.getManyToMany();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should support nested polymorphic relationships', async () => {
    const nestedMockClient = {
      ...mockClient,
      select: jest
        .fn()
        .mockImplementation(() => ({
          from: jest
            .fn()
            .mockImplementation(() => ({
              where: jest
                .fn()
                .mockReturnValue({
                  orderBy: jest
                    .fn()
                    .mockReturnValue({
                      limit: jest
                        .fn()
                        .mockReturnValue({
                          offset: jest
                            .fn()
                            .mockReturnValue({
                              execute: jest
                                .fn()
                                .mockResolvedValue([
                                  {
                                    id: 1,
                                    name: 'Technology',
                                    taggable: { id: 1, title: 'Test Post' },
                                  },
                                ]),
                            }),
                        }),
                    }),
                }),
              execute: jest
                .fn()
                .mockResolvedValue([
                  {
                    id: 1,
                    name: 'Technology',
                    taggable: { id: 1, title: 'Test Post' },
                  },
                ]),
            })),
        })),
    };

    const enhancedMorphQuery = new EnhancedMorphQueryBuilder(
      nestedMockClient,
      'tags',
      enhancedMorphConfig,
      schema
    );

    const results = await enhancedMorphQuery.getWithNested();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should support custom loader', async () => {
    const customLoaderConfig: EnhancedMorphConfig<typeof schema> = {
      ...enhancedMorphConfig,
      customLoader: async (client, baseResults, config) => {
        return baseResults.reduce(
          (acc, result, index) => {
            acc[index] = { customData: `Custom data for ${result.id}` };
            return acc;
          },
          {} as Record<string, any>
        );
      },
    };

    const customLoaderMockClient = {
      ...mockClient,
      select: jest
        .fn()
        .mockReturnValue({
          from: jest
            .fn()
            .mockReturnValue({
              execute: jest
                .fn()
                .mockResolvedValue([
                  { id: 1, name: 'Technology', createdAt: new Date() },
                ]),
            }),
        }),
    };

    const enhancedMorphQuery = new EnhancedMorphQueryBuilder(
      customLoaderMockClient,
      'tags',
      customLoaderConfig,
      schema
    );

    const results = await enhancedMorphQuery.getWithCustomLoader();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toHaveProperty('taggable');
  });
});

describe('Morph Helpers', () => {
  it('should create morph config with type safety', () => {
    const config = createMorphConfig({
      typeField: 'morphable_type',
      idField: 'morphable_id',
      relationName: 'morphable',
      types: { post: 'posts', video: 'videos' },
    });

    expect(config).toBeDefined();
    expect(config.typeField).toBe('morphable_type');
    expect(config.types.post).toBe('posts');
  });

  it('should create enhanced morph config with type safety', () => {
    const config = createEnhancedMorphConfig({
      typeField: 'taggable_type',
      idField: 'taggable_id',
      relationName: 'taggable',
      types: { post: 'posts', video: 'videos' },
      pivotTable: 'taggables',
      nested: true,
    });

    expect(config).toBeDefined();
    expect(config.pivotTable).toBe('taggables');
    expect(config.nested).toBe(true);
  });

  it('should validate morph config', () => {
    const validConfig = createMorphConfig({
      typeField: 'morphable_type',
      idField: 'morphable_id',
      relationName: 'morphable',
      types: { post: 'posts', video: 'videos' },
    });

    expect(() => validateMorphConfig(validConfig, schema)).not.toThrow();

    const invalidConfig = createMorphConfig({
      typeField: 'morphable_type',
      idField: 'morphable_id',
      relationName: 'morphable',
      types: { post: 'nonexistent_table' as any },
    });

    expect(() => validateMorphConfig(invalidConfig, schema)).toThrow();
  });

  it('should validate enhanced morph config', () => {
    const validConfig = createEnhancedMorphConfig({
      typeField: 'taggable_type',
      idField: 'taggable_id',
      relationName: 'taggable',
      types: { post: 'posts', video: 'videos' },
      pivotTable: 'taggables',
    });

    expect(() =>
      validateEnhancedMorphConfig(validConfig, schema)
    ).not.toThrow();

    const invalidConfig = createEnhancedMorphConfig({
      typeField: 'taggable_type',
      idField: 'taggable_id',
      relationName: 'taggable',
      types: { post: 'posts' },
      pivotTable: 'nonexistent_table' as any,
    });

    expect(() => validateEnhancedMorphConfig(invalidConfig, schema)).toThrow();
  });

  it('should get morph type names', () => {
    const config = createMorphConfig({
      typeField: 'morphable_type',
      idField: 'morphable_id',
      relationName: 'morphable',
      types: { post: 'posts', video: 'videos', user: 'users' },
    });

    const typeNames = getMorphTypeNames(config);
    expect(typeNames).toEqual(['post', 'video', 'user']);
  });

  it('should validate morph types', () => {
    const config = createMorphConfig({
      typeField: 'morphable_type',
      idField: 'morphable_id',
      relationName: 'morphable',
      types: { post: 'posts', video: 'videos' },
    });

    expect(isValidMorphType(config, 'post')).toBe(true);
    expect(isValidMorphType(config, 'video')).toBe(true);
    expect(isValidMorphType(config, 'user')).toBe(false);
    expect(isValidMorphType(config, 'invalid')).toBe(false);
  });
});
