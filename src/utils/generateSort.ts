import { CrudSorting } from "@refinedev/core";

export const generateSort = (sorters?: CrudSorting) => {
    if (!sorters || sorters.length === 0) {
        return;
    }

    return sorters
        .map(item => `${item.field} ${item.order}`)
        .join(', ');
};