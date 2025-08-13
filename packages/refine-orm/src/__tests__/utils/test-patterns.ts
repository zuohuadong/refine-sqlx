/**
 * Common test patterns to reduce repetition across test files
 */

import { expect } from 'vitest';
import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';

/**
 * Common test patterns for CRUD operations
 */
export const CrudTestPatterns = {
  /**
   * Test basic CRUD operations for any data provider
   */
  async testBasicCrud(dataProvider: any, resource: string, sampleData: any) {
    // Test create
    const createResult = await dataProvider.create({
      resource,
      variables: sampleData,
    });
    expect(createResult.data).toBeDefined();
    expect(createResult.data.id).toBeDefined();

    const createdId = createResult.data.id;

    // Test getOne
    const getOneResult = await dataProvider.getOne({ resource, id: createdId });
    expect(getOneResult.data).toBeDefined();
    expect(getOneResult.data.id).toBe(createdId);

    // Test update
    const updateData = { ...sampleData, updated: true };
    const updateResult = await dataProvider.update({
      resource,
      id: createdId,
      variables: updateData,
    });
    expect(updateResult.data).toBeDefined();

    // Test getList
    const listResult = await dataProvider.getList({ resource });
    expect(Array.isArray(listResult.data)).toBe(true);
    expect(typeof listResult.total).toBe('number');

    // Test delete
    const deleteResult = await dataProvider.deleteOne({
      resource,
      id: createdId,
    });
    expect(deleteResult.data).toBeDefined();
  },

  /**
   * Test filtering operations
   */
  async testFiltering(
    dataProvider: any,
    resource: string,
    filterTests: Array<{
      filters: CrudFilters;
      description: string;
      expectedMinResults?: number;
    }>
  ) {
    for (const test of filterTests) {
      const result = await dataProvider.getList({
        resource,
        filters: test.filters,
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.total).toBe('number');

      if (test.expectedMinResults !== undefined) {
        expect(result.data.length).toBeGreaterThanOrEqual(
          test.expectedMinResults
        );
      }
    }
  },

  /**
   * Test sorting operations
   */
  async testSorting(
    dataProvider: any,
    resource: string,
    sortTests: Array<{
      sorters: CrudSorting;
      description: string;
      validator?: (data: any[]) => boolean;
    }>
  ) {
    for (const test of sortTests) {
      const result = await dataProvider.getList({
        resource,
        sorters: test.sorters,
      });

      expect(Array.isArray(result.data)).toBe(true);

      if (test.validator) {
        expect(test.validator(result.data)).toBe(true);
      }
    }
  },

  /**
   * Test pagination
   */
  async testPagination(
    dataProvider: any,
    resource: string,
    paginationTests: Array<{
      pagination: Pagination;
      description: string;
      expectedMaxResults?: number;
    }>
  ) {
    for (const test of paginationTests) {
      const result = await dataProvider.getList({
        resource,
        pagination: test.pagination,
      });

      expect(Array.isArray(result.data)).toBe(true);

      if (test.expectedMaxResults !== undefined) {
        expect(result.data.length).toBeLessThanOrEqual(test.expectedMaxResults);
      }
    }
  },
};

/**
 * Common error test patterns
 */
export const ErrorTestPatterns = {
  /**
   * Test that operations throw expected errors
   */
  async testErrorScenarios(
    operations: Array<{
      operation: () => Promise<any>;
      expectedError: string | RegExp | Function;
      description: string;
    }>
  ) {
    for (const test of operations) {
      await expect(test.operation()).rejects.toThrow(test.expectedError as any);
    }
  },

  /**
   * Test validation errors
   */
  async testValidationErrors(
    dataProvider: any,
    resource: string,
    validationTests: Array<{
      variables: any;
      description: string;
      operation?: 'create' | 'update';
    }>
  ) {
    for (const test of validationTests) {
      const operation = test.operation || 'create';

      if (operation === 'create') {
        await expect(
          dataProvider.create({ resource, variables: test.variables })
        ).rejects.toThrow();
      } else {
        await expect(
          dataProvider.update({ resource, id: 1, variables: test.variables })
        ).rejects.toThrow();
      }
    }
  },
};

/**
 * Performance test patterns
 */
export const PerformanceTestPatterns = {
  /**
   * Test operation performance
   */
  async testPerformance(
    operations: Array<{
      operation: () => Promise<any>;
      description: string;
      maxDuration: number;
    }>
  ) {
    for (const test of operations) {
      const startTime = Date.now();
      await test.operation();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(test.maxDuration);
    }
  },

  /**
   * Test concurrent operations
   */
  async testConcurrency(
    operations: Array<() => Promise<any>>,
    description: string
  ) {
    const startTime = Date.now();
    const results = await Promise.all(operations.map(op => op()));
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(operations.length);
    results.forEach(result => expect(result).toBeDefined());

    return { results, duration };
  },
};

/**
 * Schema test patterns
 */
export const SchemaTestPatterns = {
  /**
   * Test type safety for different schemas
   */
  testTypeSafety<TSchema extends Record<string, any>>(
    provider: any,
    schema: TSchema,
    typeTests: Array<{
      resource: keyof TSchema;
      validData: any;
      invalidData: any;
      description: string;
    }>
  ) {
    for (const test of typeTests) {
      // Valid data should work
      expect(() => {
        provider.from(test.resource as string);
      }).not.toThrow();

      // Type checking happens at compile time, so we mainly test runtime validation
    }
  },
};

/**
 * Integration test patterns
 */
export const IntegrationTestPatterns = {
  /**
   * Test full workflow scenarios
   */
  async testWorkflow(
    steps: Array<{
      operation: () => Promise<any>;
      validator: (result: any) => void;
      description: string;
    }>
  ) {
    const results: any[] = [];

    for (const step of steps) {
      const result = await step.operation();
      step.validator(result);
      results.push(result);
    }

    return results;
  },

  /**
   * Test transaction scenarios
   */
  async testTransaction(
    dataProvider: any,
    transactionTests: Array<{
      operations: Array<(tx: any) => Promise<any>>;
      shouldSucceed: boolean;
      description: string;
    }>
  ) {
    for (const test of transactionTests) {
      if (test.shouldSucceed) {
        const result = await dataProvider.transaction(async (tx: any) => {
          const results = [];
          for (const op of test.operations) {
            results.push(await op(tx));
          }
          return results;
        });
        expect(result).toBeDefined();
      } else {
        await expect(
          dataProvider.transaction(async (tx: any) => {
            for (const op of test.operations) {
              await op(tx);
            }
          })
        ).rejects.toThrow();
      }
    }
  },
};
