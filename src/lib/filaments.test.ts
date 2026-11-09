import { it, expect } from "vitest";
import filaments from "./filaments.json";
import { demoFilaments, demoOrders } from "./demo";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("contains the 12 purchased Insignia filaments, with silk distinct from glitter", () => {
  expect(filaments).toHaveLength(12);
  expect(new Set(filaments.map((f) => f.id)).size).toBe(12);
  expect(filaments.every((f) => f.brand === "Insignia" && f.available)).toBe(
    true,
  );
  expect(
    filaments.filter((f) => f.material === "Silk PLA").map((f) => f.name),
  ).toEqual(["Silk Gold", "Silk Silver"]);
  expect(
    filaments.filter((f) => f.material === "PLA Glitter").map((f) => f.name),
  ).toEqual(["Cosmic Purple", "Galaxy Green"]);
  expect(filaments.map((f) => f.name)).toEqual([
    "White",
    "Black",
    "Blue",
    "Silk Gold",
    "Silk Silver",
    "Glow Rainbow",
    "Cosmic Purple",
    "Pink",
    "Coral Pink",
    "Red",
    "Galaxy Green",
    "Jungle Green",
  ]);
});
it("uses the real catalog everywhere in the preview", () => {
  expect(demoFilaments).toEqual(filaments);
  for (const order of demoOrders)
    for (const part of order.parts)
      if (part.filamentId)
        expect(filaments.some((f) => f.id === part.filamentId)).toBe(true);
});
it("seeds the same 12 live filaments without duplicating or resetting availability", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      "create table filaments(id uuid primary key,name text,brand text,material text,color text,available boolean)",
    );
    const sql = readFileSync("supabase/seed.sql", "utf8");
    await pg.exec(sql);
    expect(
      (await pg.query("select * from filaments order by id")).rows,
    ).toEqual(filaments);
    await pg.query("update filaments set available=false where id=$1", [
      filaments[0].id,
    ]);
    await pg.exec(sql);
    expect((await pg.query("select * from filaments")).rows).toHaveLength(12);
    expect(
      (
        await pg.query("select available from filaments where id=$1", [
          filaments[0].id,
        ])
      ).rows,
    ).toEqual([{ available: false }]);
  } finally {
    await pg.close();
  }
});
