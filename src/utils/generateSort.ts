import { CrudSorting } from "@refinedev/core";

export const generateSort = (sorters?: CrudSorting) => {
    if (!sorters?.length) return;

    return sorters
        .map(item => `${item.field} ${item.order}`)
        .join(', ');
};