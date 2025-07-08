import { describe, it, expect } from 'vitest';
import { CrudFilters } from "@refinedev/core";
import { generateFilter } from "../../src/utils/generateFilter";

describe("generateFilter", () => {
    it("returns an empty string when no filters are provided", () => {
        const result = generateFilter();
        expect(result).toEqual("");
    });

    it("creates a filter object based on the provided filters", () => {
        const filters: CrudFilters = [
            { field: "title", operator: "eq", value: "Quia ducimus voluptate." },
            { field: "category_id", operator: "gte", value: 4 },
        ];
        const result = generateFilter(filters);
        expect(result).toEqual("title IS 'Quia ducimus voluptate.' AND category_id >= '4'");
    });

    it.each(["or", "and"])(
        "throws an error for unsupported '%s' operator",
        (operator: string) => {
            const filters: CrudFilters = [
                { field: "name", operator: operator as any, value: "test" },
            ];
            expect(() => generateFilter(filters)).toThrow();
        },
    );
});