import {CrudOperators} from "@refinedev/core";

const ops: Partial<Record<CrudOperators, string>> = {
    ne: "IS NOT",
    gte: ">=",
    lte: "<=",
    contains: "LIKE",
    eq: "IS",
    gt: ">",
    lt: "<"
};

export const mapOperator = (operator: CrudOperators): string => {
    return ops[operator] || "=";
};
