import {CrudFilters} from "@refinedev/core";
import {mapOperator} from "./mapOperator";

export const generateFilter = (filters?: CrudFilters) => {
    if (!filters?.length) return "";

    const conditions = filters
        .filter(filter => "field" in filter)
        .map(filter => {
            const { field, operator, value } = filter as any;
            const mappedOperator = mapOperator(operator);
            
            // Throw error for unsupported logical operators
            if (operator === 'or' || operator === 'and') {
                throw new Error(`Logical operator '${operator}' is not supported. Use individual field filters instead.`);
            }
            
            // If operator maps to empty string, use default '='
            const sqlOperator = mappedOperator || '=';
            return `${field} ${sqlOperator} '${value}'`;
        });

    return conditions.join(" AND ");
};