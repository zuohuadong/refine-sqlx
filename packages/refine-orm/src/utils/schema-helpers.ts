import type { Table } from 'drizzle-orm';

/**
 * Extract column information from a Drizzle table
 */
export function extractTableColumns<TTable extends Table>(
  table: TTable
): Record<string, any> {
  // This is a simplified implementation
  // In a real scenario, you'd need to access Drizzle's internal column definitions
  const columns: Record<string, any> = {};

  // Access the table's column definitions
  // Note: This is a placeholder - actual implementation would depend on Drizzle's internal API
  if (table && typeof table === 'object' && 'Symbol.toStringTag' in table) {
    // Try to access columns through Drizzle's internal structure
    const tableConfig = (table as any)[Symbol.for('drizzle:table-config')];
    if (tableConfig?.columns) {
      for (const [name, column] of Object.entries(tableConfig.columns)) {
        columns[name] = column;
      }
    }
  }

  return columns;
}

/**
 * Get column type information from a Drizzle column
 */
export function getColumnInfo(column: any): {
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
} {
  // This is a simplified implementation
  // In practice, you'd inspect the column's configuration
  const columnConfig = column?.config || {};

  return {
    type: columnConfig.dataType || 'unknown',
    nullable: !columnConfig.notNull,
    hasDefault: columnConfig.hasDefault || false,
    isPrimaryKey: columnConfig.primaryKey || false,
    isUnique: columnConfig.unique || false,
    isAutoIncrement: columnConfig.autoIncrement || false,
  };
}

// Schema validation is handled by drizzle-orm's built-in type inference

/**
 * Detect foreign key relationships based on column naming conventions
 */
export function detectForeignKeys(
  tableName: string,
  columns: Record<string, any>,
  allTableNames: string[]
): Array<{
  column: string;
  referencedTable: string;
  referencedColumn: string;
}> {
  const foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }> = [];

  for (const columnName of Object.keys(columns)) {
    // Common foreign key patterns
    const patterns = [
      { regex: /^(.+)_id$/, suffix: 's', refColumn: 'id' }, // user_id -> users.id
      { regex: /^(.+)Id$/, suffix: 's', refColumn: 'id' }, // userId -> users.id
      { regex: /^(.+)_uuid$/, suffix: 's', refColumn: 'uuid' }, // user_uuid -> users.uuid
      { regex: /^(.+)Uuid$/, suffix: 's', refColumn: 'uuid' }, // userUuid -> users.uuid
    ];

    for (const pattern of patterns) {
      const match = columnName.match(pattern.regex);
      if (match) {
        const baseName = match[1];

        // Try different table name variations
        const possibleTableNames = [
          `${baseName}${pattern.suffix}`, // user -> users
          `${baseName}es`, // box -> boxes
          baseName, // user -> user
          pluralize(baseName), // category -> categories
        ];

        for (const possibleTable of possibleTableNames) {
          if (
            allTableNames.includes(possibleTable) &&
            possibleTable !== tableName
          ) {
            foreignKeys.push({
              column: columnName,
              referencedTable: possibleTable,
              referencedColumn: pattern.refColumn,
            });
            break;
          }
        }
      }
    }
  }

  return foreignKeys;
}

/**
 * Detect polymorphic relationships
 */
export function detectPolymorphicRelations(
  columns: Record<string, any>
): Array<{ typeColumn: string; idColumn: string; baseName: string }> {
  const morphRelations: Array<{
    typeColumn: string;
    idColumn: string;
    baseName: string;
  }> = [];

  for (const columnName of Object.keys(columns)) {
    // Look for polymorphic type columns
    const typePatterns = [
      /^(.+)_type$/, // commentable_type
      /^(.+)Type$/, // commentableType
    ];

    for (const pattern of typePatterns) {
      const match = columnName.match(pattern);
      if (match) {
        const baseName = match[1];

        // Look for corresponding ID columns
        const possibleIdColumns = [
          `${baseName}_id`,
          `${baseName}Id`,
          `${baseName}_uuid`,
          `${baseName}Uuid`,
        ];

        for (const idColumn of possibleIdColumns) {
          if (columns[idColumn]) {
            morphRelations.push({ typeColumn: columnName, idColumn, baseName });
            break;
          }
        }
      }
    }
  }

  return morphRelations;
}

/**
 * Generate TypeScript interface from table schema
 */
export function generateTableInterface<TTable extends Table>(
  tableName: string,
  table: TTable,
  mode: 'select' | 'insert' | 'update' = 'select'
): string {
  const columns = extractTableColumns(table);
  const interfaceName = `${capitalize(tableName)}${capitalize(mode)}`;

  const fields: string[] = [];

  for (const [columnName, column] of Object.entries(columns)) {
    const info = getColumnInfo(column);
    let tsType = mapColumnTypeToTypeScript(info.type);

    // Handle nullable columns
    if (info.nullable) {
      tsType += ' | null';
    }

    // Handle optional fields
    let optional = '';
    if (mode === 'insert' && (info.hasDefault || info.isAutoIncrement)) {
      optional = '?';
    } else if (mode === 'update') {
      optional = '?';
    } else if (info.nullable) {
      optional = '?';
    }

    fields.push(`  ${columnName}${optional}: ${tsType};`);
  }

  return `export interface ${interfaceName} {\n${fields.join('\n')}\n}`;
}

/**
 * Map database column types to TypeScript types
 */
export function mapColumnTypeToTypeScript(columnType: string): string {
  switch (columnType.toLowerCase()) {
    case 'varchar':
    case 'text':
    case 'char':
    case 'string':
    case 'uuid':
      return 'string';

    case 'integer':
    case 'int':
    case 'smallint':
    case 'bigint':
    case 'decimal':
    case 'numeric':
    case 'float':
    case 'double':
    case 'real':
      return 'number';

    case 'boolean':
    case 'bool':
      return 'boolean';

    case 'date':
    case 'timestamp':
    case 'datetime':
      return 'Date';

    case 'json':
    case 'jsonb':
      return 'Record<string, any>';

    default:
      return 'any';
  }
}

/**
 * Validate schema structure and relationships
 */
export function validateSchemaStructure<TSchema extends Record<string, Table>>(
  schema: TSchema
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const tableNames = Object.keys(schema);

  for (const [tableName, table] of Object.entries(schema)) {
    const columns = extractTableColumns(table);

    // Check for primary key
    let hasPrimaryKey = false;
    for (const column of Object.values(columns)) {
      const info = getColumnInfo(column);
      if (info.isPrimaryKey) {
        hasPrimaryKey = true;
        break;
      }
    }

    if (!hasPrimaryKey) {
      errors.push(`Table '${tableName}' does not have a primary key`);
    }

    // Check for potential foreign key issues
    const foreignKeys = detectForeignKeys(tableName, columns, tableNames);
    for (const fk of foreignKeys) {
      if (!tableNames.includes(fk.referencedTable)) {
        warnings.push(
          `Table '${tableName}' has foreign key '${fk.column}' referencing non-existent table '${fk.referencedTable}'`
        );
      }
    }

    // Check for naming conventions
    if (!tableName.match(/^[a-z][a-z0-9_]*$/)) {
      warnings.push(
        `Table '${tableName}' does not follow snake_case naming convention`
      );
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Simple pluralization function
 */
export function pluralize(word: string): string {
  if (
    word.endsWith('y') &&
    !word.endsWith('ay') &&
    !word.endsWith('ey') &&
    !word.endsWith('iy') &&
    !word.endsWith('oy') &&
    !word.endsWith('uy')
  ) {
    return `${word.slice(0, -1)}ies`;
  }
  if (
    word.endsWith('s') ||
    word.endsWith('sh') ||
    word.endsWith('ch') ||
    word.endsWith('x') ||
    word.endsWith('z')
  ) {
    return `${word}es`;
  }
  if (word.endsWith('f')) {
    return `${word.slice(0, -1)}ves`;
  }
  if (word.endsWith('fe')) {
    return `${word.slice(0, -2)}ves`;
  }
  return `${word}s`;
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Generate a schema registry for runtime schema management
 */
export function createSchemaRegistry<TSchema extends Record<string, Table>>(
  initialSchema?: TSchema
): {
  register<TName extends string, TTable extends Table>(
    name: TName,
    table: TTable
  ): void;
  unregister(name: string): void;
  get(name: string): Table | undefined;
  has(name: string): boolean;
  list(): string[];
  getAll(): Record<string, Table>;
} {
  const registry = new Map<string, Table>();

  // Initialize with provided schema
  if (initialSchema) {
    for (const [name, table] of Object.entries(initialSchema)) {
      registry.set(name, table);
    }
  }

  return {
    register<TName extends string, TTable extends Table>(
      name: TName,
      table: TTable
    ): void {
      registry.set(name, table);
    },

    unregister(name: string): void {
      registry.delete(name);
    },

    get(name: string): Table | undefined {
      return registry.get(name);
    },

    has(name: string): boolean {
      return registry.has(name);
    },

    list(): string[] {
      return Array.from(registry.keys());
    },

    getAll(): Record<string, Table> {
      const result: Record<string, Table> = {};
      for (const [name, table] of Array.from(registry.entries())) {
        result[name] = table;
      }
      return result;
    },
  };
}
