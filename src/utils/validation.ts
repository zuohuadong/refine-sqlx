/**
 * D1 configuration validation utilities
 */

import type { D1Options } from '../types';
import { DEFAULT_BATCH_SIZE } from './batch';

/**
 * Get optimal batch size based on D1 options
 * @internal
 */
export function getBatchSize(options?: D1Options): number {
  return options?.batch?.maxSize ?? DEFAULT_BATCH_SIZE;
}

/**
 * Validate D1 options
 *
 * This validation works for both the main package and the D1-specific package.
 * It ensures D1 configuration is valid when provided.
 *
 * @param options - D1 options to validate
 * @throws Error if options are invalid
 *
 * @internal
 */
export function validateD1Options(options?: D1Options): void {
  if (!options) return;

  // Validate batch options
  if (options.batch?.maxSize !== undefined) {
    if (options.batch.maxSize <= 0) {
      throw new Error('D1 batch maxSize must be greater than 0');
    }
    if (options.batch.maxSize > 100) {
      console.warn(
        `D1 batch maxSize of ${options.batch.maxSize} exceeds recommended limit of 50. ` +
          `This may impact performance, especially on Cloudflare D1.`,
      );
    }
  }

  // Validate Time Travel options
  if (options.timeTravel?.enabled) {
    if (!options.timeTravel.bookmark) {
      throw new Error(
        'D1 Time Travel is enabled but no bookmark or timestamp was provided',
      );
    }
  }
}
