import {CrudFilters} from "@refinedev/core";
import {mapOperator} from "./mapOperator";

export const generateFilter = (filters?: CrudFilters) => {
    if (!filters?.length) return "";

    const conditions = filters
        .filter(filter => "field" in filter)
        .map(filter => {
            const { field, operator, value } = filter as any;
            return `${field} ${mapOperator(operator)} '${value}'`;
        });

    return conditions.join(" AND ");
};