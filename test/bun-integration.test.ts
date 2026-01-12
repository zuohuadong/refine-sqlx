import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { createRefineSQL } from "../src/index";

const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name"),
    email: text("email"),
    created_at: integer("created_at", { mode: "timestamp" }),
});

describe("RefineSQL with Bun SQLite", () => {
    let db: any;
    let provider: any;

    beforeEach(async () => {
        const sqlite = new Database(":memory:");
        db = drizzle(sqlite);

        // Create table
        sqlite.run(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT,
                created_at INTEGER
            )
        `);

        provider = await createRefineSQL({
            connection: db,
            schema: { users },
        });
    });

    test("should create and list records", async () => {
        // Create
        await provider.create({
            resource: "users",
            variables: {
                name: "John Doe",
                email: "john@example.com",
            },
        });

        // List
        const list = await provider.getList({
            resource: "users",
            pagination: { current: 1, pageSize: 10 },
        });

        expect(list.total).toBe(1);
        expect(list.data[0]).toMatchObject({
            name: "John Doe",
            email: "john@example.com",
        });
    });

    test("should update records", async () => {
        const created = await provider.create({
            resource: "users",
            variables: { name: "Jane" },
        });

        const updated = await provider.update({
            resource: "users",
            id: created.data.id,
            variables: { name: "Jane Doe" },
        });

        expect(updated.data.name).toBe("Jane Doe");
    });

    test("should delete records", async () => {
        const created = await provider.create({
            resource: "users",
            variables: { name: "To Delete" },
        });

        await provider.deleteOne({
            resource: "users",
            id: created.data.id,
        });

        const list = await provider.getList({
            resource: "users",
        });

        expect(list.total).toBe(0);
    });
});
