import { describe, expect, it } from "vitest";
import { extractModuleTable, LuaParseError, parseLuaValue } from "./lua-literal.ts";

describe("parseLuaValue", () => {
  it("lit les scalaires", () => {
    expect(parseLuaValue('"a\\"b"').value).toBe('a"b');
    expect(parseLuaValue("'x'").value).toBe("x");
    expect(parseLuaValue("[[long\nstring]]").value).toBe("long\nstring");
    expect(parseLuaValue("-3.5").value).toBe(-3.5);
    expect(parseLuaValue(".25").value).toBe(0.25);
    expect(parseLuaValue("1e3").value).toBe(1000);
    expect(parseLuaValue("0x10").value).toBe(16);
    expect(parseLuaValue("true").value).toBe(true);
    expect(parseLuaValue("nil").value).toBe(null);
  });

  it("lit les tables positionnelles et à clés, avec commentaires", () => {
    const src = `{
      -- commentaire
      id = "roller_03", time = 8; --[[ bloc
      multi-ligne ]] ["Clé avec espace"] = { 1, 2, 3, },
      [5] = "cinq",
    }`;
    expect(parseLuaValue(src).value).toEqual({
      id: "roller_03",
      time: 8,
      "Clé avec espace": [1, 2, 3],
      "5": "cinq",
    });
  });

  it("table vide → tableau vide", () => {
    expect(parseLuaValue("{}").value).toEqual([]);
  });

  it("refuse les expressions non littérales", () => {
    expect(() => parseLuaValue("{ a = foo }")).toThrow(LuaParseError);
    expect(() => parseLuaValue("{ a = 3 * 2 }")).toThrow(/arithmétique/);
    expect(() => parseLuaValue("{ a = 1, a = 2 }")).toThrow(/double/);
    expect(() => parseLuaValue('{ a = "x }')).toThrow(/non fermée/);
  });

  it("indique la ligne de l'erreur", () => {
    try {
      parseLuaValue("{\n a = 1,\n b = bar(),\n}");
      expect.unreachable();
    } catch (e) {
      expect((e as LuaParseError).line).toBe(3);
    }
  });
});

describe("extractModuleTable", () => {
  it("module de recettes (return { … })", () => {
    const src = `-- Recipes for the Roller
return {
    {
        id = "roller_03",
        time = 8,
        mamyflux = "6250MF",
        inputs = {
            { item = "Steel Ingot", amount = 2 },
        },
        outputs = {
            { item = "Steel Rod", amount = 2 },
        }
    },
}`;
    expect(extractModuleTable(src)).toEqual([
      {
        id: "roller_03",
        time: 8,
        mamyflux: "6250MF",
        inputs: [{ item: "Steel Ingot", amount: 2 }],
        outputs: [{ item: "Steel Rod", amount: 2 }],
      },
    ]);
  });

  it("module RS/Data (local p = { … } suivi de code)", () => {
    const src = `local main = bucket("rs_main")
local p = {
  ["Production"] = { ["Coal Extracting"] = { RP = 10, Buildings = { "Coal Drill" } } },
}
for k, v in pairs(p) do main.put(k) end
return p`;
    expect(extractModuleTable(src, "p")).toEqual({
      Production: { "Coal Extracting": { RP: 10, Buildings: ["Coal Drill"] } },
    });
  });

  it("échoue clairement si la table est absente", () => {
    expect(() => extractModuleTable("return foo()")).toThrow(LuaParseError);
  });
});
