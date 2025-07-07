import { D1Database } from '../src/types';

// Mock D1 Database for testing
export class MockD1Database implements D1Database {
  private data: Record<string, any[]> = {
    posts: [
      { id: 1, title: 'Test Post', category_id: 1, published: true },
      { id: 2, title: 'Another Post', category_id: 2, published: false }
    ],
    categories: [
      { id: 1, name: 'Technology' },
      { id: 2, name: 'Health' }
    ]
  };

  prepare(query: string) {
    return {
      bind: (...values: unknown[]) => this.createStatement(query, values),
      first: <T = unknown>() => this.executeFirst<T>(query, []),
      run: () => this.executeRun(query, []),
      all: <T = unknown>() => this.executeAll<T>(query, []),
      raw: <T = unknown>() => this.executeRaw<T>(query, [])
    };
  }

  private createStatement(query: string, params: unknown[]) {
    return {
      bind: (...values: unknown[]) => this.createStatement(query, [...params, ...values]),
      first: <T = unknown>() => this.executeFirst<T>(query, params),
      run: () => this.executeRun(query, params),
      all: <T = unknown>() => this.executeAll<T>(query, params),
      raw: <T = unknown>() => this.executeRaw<T>(query, params)
    };
  }

  private executeFirst<T>(query: string, params: unknown[]): Promise<T | null> {
    const result = this.executeQuery(query, params);
    return Promise.resolve(result.length > 0 ? result[0] as T : null);
  }

  private executeRun(query: string, params: unknown[]) {
    const result = this.executeQuery(query, params);
    const lastInsertedId = result.length > 0 ? result[result.length - 1].id : 0;
    
    return Promise.resolve({
      results: result,
      success: true,
      meta: {
        changed_db: true,
        changes: result.length,
        duration: 0,
        last_row_id: lastInsertedId,
        rows_read: result.length,
        rows_written: result.length,
        size_after: 0
      },
      // D1 format includes lastInsertRowid at the top level
      lastInsertRowid: lastInsertedId
    });
  }

  private executeAll<T>(query: string, params: unknown[]) {
    const result = this.executeQuery(query, params);
    return Promise.resolve({
      results: result as T[],
      success: true,
      meta: {
        changed_db: false,
        changes: 0,
        duration: 0,
        last_row_id: 0,
        rows_read: result.length,
        rows_written: 0,
        size_after: 0
      }
    });
  }

  private executeRaw<T>(query: string, params: unknown[]): Promise<T[]> {
    const result = this.executeQuery(query, params);
    return Promise.resolve(result as T[]);
  }

  private executeQuery(query: string, params: unknown[]): any[] {
    const lowerQuery = query.toLowerCase().trim();
    
    // Simple query parsing for testing
    if (lowerQuery.startsWith('select')) {
      const resourceMatch = query.match(/from\s+(\w+)/i);
      if (resourceMatch) {
        const resource = resourceMatch[1];
        let results = [...(this.data[resource] || [])];
        
        // Handle COUNT queries
        if (query.includes('COUNT(*)')) {
          const totalCount = results.length;
          return [{ count: totalCount }];
        }
        
        // Handle WHERE clause with ID
        const whereIdMatch = query.match(/where\s+id\s*=\s*\?/i);
        if (whereIdMatch && params.length > 0) {
          const id = params[0];
          results = results.filter(item => item.id == id);
        }
        
        // Handle WHERE clause with IN (placeholders)
        const whereInPlaceholderMatch = query.match(/where\s+id\s+in\s*\(([?]+(?:\s*,\s*[?]+)*)\)/i);
        if (whereInPlaceholderMatch && params.length > 0) {
          const ids = params.map(id => parseInt(String(id)));
          results = results.filter(item => ids.includes(item.id));
        } else {
          // Handle WHERE clause with IN (literal values)
          const whereInMatch = query.match(/where\s+id\s+in\s*\(([^)]+)\)/i);
          if (whereInMatch) {
            const ids = whereInMatch[1].split(',').map(id => parseInt(id.trim()));
            results = results.filter(item => ids.includes(item.id));
          }
        }
        
        // Handle ORDER BY
        const orderByMatch = query.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
        if (orderByMatch) {
          const field = orderByMatch[1];
          const direction = orderByMatch[2]?.toLowerCase() || 'asc';
          results.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            if (direction === 'desc') {
              return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
            }
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          });
        }
        
        // Handle LIMIT and OFFSET
        const limitMatch = query.match(/limit\s+(\d+)(?:\s+offset\s+(\d+))?/i);
        if (limitMatch) {
          const limit = parseInt(limitMatch[1]);
          const offset = parseInt(limitMatch[2] || '0');
          results = results.slice(offset, offset + limit);
        }
        
        return results;
      }
    } else if (lowerQuery.startsWith('insert')) {
      const resourceMatch = query.match(/into\s+(\w+)/i);
      if (resourceMatch) {
        const resource = resourceMatch[1];
        const parsedValues = this.parseInsertValues(query, params);
        
        // Use provided ID if available, otherwise generate new one
        const newId = parsedValues.id || Math.max(...(this.data[resource] || []).map(item => item.id), 0) + 1;
        const newItem = { id: newId, ...parsedValues };
        
        this.data[resource] = this.data[resource] || [];
        this.data[resource].push(newItem);
        return [newItem];
      }
    } else if (lowerQuery.startsWith('update')) {
      const resourceMatch = query.match(/update\s+(\w+)/i);
      if (resourceMatch) {
        const resource = resourceMatch[1];
        const idMatch = query.match(/where\s+id\s*=\s*\?/i);
        if (idMatch && params.length > 0) {
          const id = params[params.length - 1];
          const itemIndex = (this.data[resource] || []).findIndex(item => item.id == id);
          if (itemIndex !== -1) {
            const updates = this.parseUpdateValues(query, params);
            this.data[resource][itemIndex] = { ...this.data[resource][itemIndex], ...updates };
            return [this.data[resource][itemIndex]];
          }
        }
      }
    } else if (lowerQuery.startsWith('delete')) {
      const resourceMatch = query.match(/from\s+(\w+)/i);
      if (resourceMatch) {
        const resource = resourceMatch[1];
        const idMatch = query.match(/where\s+id\s*=\s*\?/i);
        if (idMatch && params.length > 0) {
          const id = params[0];
          const itemIndex = (this.data[resource] || []).findIndex(item => item.id == id);
          if (itemIndex !== -1) {
            const deletedItem = this.data[resource][itemIndex];
            this.data[resource].splice(itemIndex, 1);
            return [deletedItem];
          }
        }
      }
    }
    
    return [];
  }

  private parseInsertValues(query: string, params: unknown[]): Record<string, any> {
    // Simple parsing - in real implementation this would be more robust
    const columnsMatch = query.match(/\(([^)]+)\)/);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(col => col.trim());
      const result: Record<string, any> = {};
      columns.forEach((col, index) => {
        if (params[index] !== undefined) {
          result[col] = params[index];
        }
      });
      return result;
    }
    return {};
  }

  private parseUpdateValues(query: string, params: unknown[]): Record<string, any> {
    // Simple parsing - in real implementation this would be more robust
    const setMatch = query.match(/set\s+(.+?)\s+where/i);
    if (setMatch) {
      const setPart = setMatch[1];
      const assignments = setPart.split(',');
      const result: Record<string, any> = {};
      assignments.forEach((assignment, index) => {
        const [column] = assignment.split('=').map(part => part.trim());
        if (params[index] !== undefined) {
          result[column] = params[index];
        }
      });
      return result;
    }
    return {};
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async batch<T = unknown>(statements: any[]): Promise<any[]> {
    return statements.map(stmt => ({ results: [], success: true }));
  }

  async exec(query: string): Promise<any> {
    return { count: 0, duration: 0 };
  }
}
