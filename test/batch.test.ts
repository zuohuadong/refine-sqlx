/**
 * Unit tests for batch operations utilities
 * Tests batch utilities in the main package to ensure they work with all database adapters
 */

import type { DataProvider } from '@refinedev/core';
import {
  batchDelete,
  batchInsert,
  batchUpdate,
  DEFAULT_BATCH_SIZE,
} from '../src/utils/batch';
import { getBatchSize, validateD1Options } from '../src/utils/validation';
import type { D1Options } from '../src/types';

describe('Batch Operations (Main Package)', () => {
  describe('batchInsert', () => {
    it('should handle empty array', async () => {
      const mockDataProvider = {} as DataProvider;
      const result = await batchInsert(mockDataProvider, 'users', []);
      expect(result).toEqual([]);
    });

    it('should split large arrays into batches', async () => {
      const items = Array.from({ length: 150 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      const mockDataProvider: Partial<DataProvider> = {
        createMany: jest.fn().mockResolvedValue({
          data: items.slice(0, 50),
        }),
      };

      const result = await batchInsert(
        mockDataProvider as DataProvider,
        'users',
        items,
      );

      // Should call createMany 3 times (150 items / 50 batch size)
      expect(mockDataProvider.createMany).toHaveBeenCalledTimes(3);
    });

    it('should respect custom batch size', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        name: `User ${i}`,
      }));

      const mockDataProvider: Partial<DataProvider> = {
        createMany: jest.fn().mockResolvedValue({
          data: items.slice(0, 25),
        }),
      };

      await batchInsert(mockDataProvider as DataProvider, 'users', items, {
        batchSize: 25,
      });

      // Should call createMany 4 times (100 items / 25 batch size)
      expect(mockDataProvider.createMany).toHaveBeenCalledTimes(4);
    });

    it('should flatten results from multiple batches', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      const mockDataProvider: Partial<DataProvider> = {
        createMany: jest.fn((params: any) => {
          return Promise.resolve({ data: params.variables });
        }),
      };

      const result = await batchInsert(
        mockDataProvider as DataProvider,
        'users',
        items,
      );

      expect(result).toHaveLength(100);
      expect(result).toEqual(items);
    });

    it('should use DEFAULT_BATCH_SIZE constant', async () => {
      expect(DEFAULT_BATCH_SIZE).toBe(50);
    });
  });

  describe('batchUpdate', () => {
    it('should handle empty array', async () => {
      const mockDataProvider = {} as DataProvider;
      const result = await batchUpdate(mockDataProvider, 'users', [], {
        status: 'active',
      });
      expect(result).toEqual([]);
    });

    it('should split large ID arrays into batches', async () => {
      const ids = Array.from({ length: 120 }, (_, i) => i + 1);

      const mockDataProvider: Partial<DataProvider> = {
        updateMany: jest.fn().mockResolvedValue({
          data: ids.slice(0, 50).map((id) => ({ id, status: 'active' })),
        }),
      };

      await batchUpdate(mockDataProvider as DataProvider, 'users', ids, {
        status: 'active',
      });

      // Should call updateMany 3 times (120 ids / 50 batch size)
      expect(mockDataProvider.updateMany).toHaveBeenCalledTimes(3);
    });

    it('should pass update variables to each batch', async () => {
      const ids = [1, 2, 3];
      const updateData = { status: 'inactive', updated_at: Date.now() };

      const mockDataProvider: Partial<DataProvider> = {
        updateMany: jest.fn((params: any) => {
          expect(params.variables).toEqual(updateData);
          return Promise.resolve({
            data: params.ids.map((id: number) => ({ id, ...updateData })),
          });
        }),
      };

      await batchUpdate(
        mockDataProvider as DataProvider,
        'users',
        ids,
        updateData,
      );

      expect(mockDataProvider.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchDelete', () => {
    it('should handle empty array', async () => {
      const mockDataProvider = {} as DataProvider;
      const result = await batchDelete(mockDataProvider, 'users', []);
      expect(result).toEqual([]);
    });

    it('should split large ID arrays into batches', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => i + 1);

      const mockDataProvider: Partial<DataProvider> = {
        deleteMany: jest.fn().mockResolvedValue({
          data: ids.slice(0, 50).map((id) => ({ id })),
        }),
      };

      await batchDelete(mockDataProvider as DataProvider, 'users', ids);

      // Should call deleteMany 2 times (100 ids / 50 batch size)
      expect(mockDataProvider.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('should return flattened results', async () => {
      const ids = Array.from({ length: 75 }, (_, i) => i + 1);

      const mockDataProvider: Partial<DataProvider> = {
        deleteMany: jest.fn((params: any) => {
          return Promise.resolve({
            data: params.ids.map((id: number) => ({ id })),
          });
        }),
      };

      const result = await batchDelete(
        mockDataProvider as DataProvider,
        'users',
        ids,
      );

      expect(result).toHaveLength(75);
      expect(mockDataProvider.deleteMany).toHaveBeenCalledTimes(2); // 75 / 50 = 2 batches
    });
  });
});

describe('Validation Utilities', () => {
  describe('getBatchSize', () => {
    it('should return default batch size when no options provided', () => {
      expect(getBatchSize()).toBe(DEFAULT_BATCH_SIZE);
    });

    it('should return custom batch size from options', () => {
      const options: D1Options = {
        batch: { maxSize: 25 },
      };
      expect(getBatchSize(options)).toBe(25);
    });

    it('should return default when batch options not set', () => {
      const options: D1Options = {};
      expect(getBatchSize(options)).toBe(DEFAULT_BATCH_SIZE);
    });
  });

  describe('validateD1Options', () => {
    it('should not throw for undefined options', () => {
      expect(() => validateD1Options()).not.toThrow();
    });

    it('should not throw for empty options', () => {
      expect(() => validateD1Options({})).not.toThrow();
    });

    it('should not throw for valid batch size', () => {
      expect(() =>
        validateD1Options({ batch: { maxSize: 50 } }),
      ).not.toThrow();
    });

    it('should throw for invalid batch size (zero)', () => {
      expect(() => validateD1Options({ batch: { maxSize: 0 } })).toThrow(
        'D1 batch maxSize must be greater than 0',
      );
    });

    it('should throw for invalid batch size (negative)', () => {
      expect(() => validateD1Options({ batch: { maxSize: -10 } })).toThrow(
        'D1 batch maxSize must be greater than 0',
      );
    });

    it('should warn for large batch size', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      validateD1Options({ batch: { maxSize: 150 } });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds recommended limit'),
      );

      consoleSpy.mockRestore();
    });

    it('should throw when Time Travel enabled without bookmark', () => {
      expect(() =>
        validateD1Options({ timeTravel: { enabled: true } }),
      ).toThrow('D1 Time Travel is enabled but no bookmark or timestamp');
    });

    it('should not throw when Time Travel enabled with bookmark', () => {
      expect(() =>
        validateD1Options({
          timeTravel: { enabled: true, bookmark: 'my-bookmark' },
        }),
      ).not.toThrow();
    });

    it('should not throw when Time Travel enabled with timestamp', () => {
      expect(() =>
        validateD1Options({
          timeTravel: { enabled: true, bookmark: 1234567890 },
        }),
      ).not.toThrow();
    });

    it('should not throw when Time Travel disabled', () => {
      expect(() =>
        validateD1Options({ timeTravel: { enabled: false } }),
      ).not.toThrow();
    });
  });
});
