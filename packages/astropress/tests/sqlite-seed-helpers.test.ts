import { describe, expect, it } from "vitest";

import {
	buildTableImportSql,
	buildTableImportStatements,
	guessMimeType,
	toSqlLiteral,
} from "../src/sqlite-seed-helpers";

describe("guessMimeType", () => {
	it("returns image/png for .png paths", () => {
		expect(guessMimeType("a.png")).toBe("image/png");
		expect(guessMimeType("/uploads/x.PNG")).toBe("image/png");
	});

	it("returns image/webp for .webp paths", () => {
		expect(guessMimeType("photo.webp")).toBe("image/webp");
	});

	it("returns image/gif for .gif paths", () => {
		expect(guessMimeType("anim.gif")).toBe("image/gif");
	});

	it("falls back to image/jpeg for unknown extensions", () => {
		expect(guessMimeType("file.jpg")).toBe("image/jpeg");
		expect(guessMimeType("file.jpeg")).toBe("image/jpeg");
		expect(guessMimeType("file.bin")).toBe("image/jpeg");
		expect(guessMimeType("file")).toBe("image/jpeg");
		expect(guessMimeType("")).toBe("image/jpeg");
	});

	it("matches case-insensitively (lowercases input first)", () => {
		expect(guessMimeType("X.WEBP")).toBe("image/webp");
		expect(guessMimeType("Y.GIF")).toBe("image/gif");
	});
});

describe("toSqlLiteral", () => {
	it("encodes null and undefined as NULL", () => {
		expect(toSqlLiteral(null)).toBe("NULL");
		expect(toSqlLiteral(undefined)).toBe("NULL");
	});

	it("renders numbers and bigints unquoted", () => {
		expect(toSqlLiteral(42)).toBe("42");
		expect(toSqlLiteral(0)).toBe("0");
		expect(toSqlLiteral(-7)).toBe("-7");
		expect(toSqlLiteral(BigInt(9007199254740993n))).toBe("9007199254740993");
	});

	it("renders booleans as 1 or 0 (sqlite convention)", () => {
		expect(toSqlLiteral(true)).toBe("1");
		expect(toSqlLiteral(false)).toBe("0");
	});

	it("renders Uint8Array as a hex blob literal", () => {
		expect(toSqlLiteral(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe(
			"X'deadbeef'",
		);
		expect(toSqlLiteral(new Uint8Array([]))).toBe("X''");
	});

	it("quotes strings and escapes embedded single quotes", () => {
		expect(toSqlLiteral("hi")).toBe("'hi'");
		expect(toSqlLiteral("it's")).toBe("'it''s'");
		expect(toSqlLiteral("a'b'c")).toBe("'a''b''c'");
		expect(toSqlLiteral("")).toBe("''");
	});

	it("stringifies non-string non-special objects (Date, etc.) and quotes the result", () => {
		const date = new Date("2026-05-03T00:00:00Z");
		expect(toSqlLiteral(date)).toBe(`'${String(date)}'`);
	});
});

describe("buildTableImportStatements", () => {
	function makeDb(
		columnsByTable: Record<string, string[]>,
		rowsByTable: Record<string, Array<Record<string, unknown>>>,
	) {
		return {
			prepare(query: string) {
				if (query.startsWith("PRAGMA table_info")) {
					const m = query.match(/table_info\((\w+)\)/);
					const table = m?.[1] ?? "";
					const cols = columnsByTable[table] ?? [];
					return {
						all: () =>
							cols.map((name, idx) => ({
								cid: idx,
								name,
								type: "TEXT",
								notnull: 0,
								dflt_value: null,
								pk: 0,
							})),
					};
				}
				const m = query.match(/SELECT \* FROM (\w+)/);
				const table = m?.[1] ?? "";
				return {
					all: () => rowsByTable[table] ?? [],
				};
			},
		} as never;
	}

	it("returns an empty list when the table has no columns", () => {
		const db = makeDb({ posts: [] }, { posts: [{ a: 1 }] });
		expect(buildTableImportStatements(db, "posts")).toEqual([]);
	});

	it("emits DELETE then one INSERT per row, in column order", () => {
		const db = makeDb(
			{ posts: ["id", "title"] },
			{
				posts: [
					{ id: 1, title: "hi" },
					{ id: 2, title: "yo" },
				],
			},
		);
		const out = buildTableImportStatements(db, "posts");
		expect(out).toEqual([
			"DELETE FROM posts;",
			"INSERT INTO posts (id, title) VALUES (1, 'hi');",
			"INSERT INTO posts (id, title) VALUES (2, 'yo');",
		]);
	});

	it("renders each row's values via toSqlLiteral (quoting + null + bool)", () => {
		const db = makeDb(
			{ items: ["a", "b", "c", "d"] },
			{
				items: [{ a: null, b: true, c: 0, d: "hello" }],
			},
		);
		expect(buildTableImportStatements(db, "items")).toEqual([
			"DELETE FROM items;",
			"INSERT INTO items (a, b, c, d) VALUES (NULL, 1, 0, 'hello');",
		]);
	});
});

describe("buildTableImportSql", () => {
	it("joins the statements with newlines", () => {
		const db = {
			prepare(query: string) {
				if (query.startsWith("PRAGMA table_info")) {
					return {
						all: () => [{ cid: 0, name: "id", type: "INTEGER" }],
					};
				}
				return { all: () => [{ id: 7 }] };
			},
		} as never;
		expect(buildTableImportSql(db, "x")).toBe(
			"DELETE FROM x;\nINSERT INTO x (id) VALUES (7);",
		);
	});
});
