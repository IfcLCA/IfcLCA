import { describe, expect, it } from "vitest";
import { isValidKbobMaterial, layerEmissions, parseDensity } from "./kbob-indicators";

describe("parseDensity", () => {
  it.each([
    [2300, 2300],
    ["470", 470],
    ["7850.5", 7850.5],
    ["-", null],
    ["", null],
    [null, null],
    [Number.NaN, null],
  ])("%j -> %j", (input, expected) => {
    expect(parseDensity(input)).toBe(expected);
  });
});

describe("isValidKbobMaterial", () => {
  const base = { gwpTotal: 0.1, ubp21Total: 100, primaryEnergyNonRenewableTotal: 0.2, density: "2300" };

  it("accepts a complete material", () => {
    expect(isValidKbobMaterial(base)).toBe(true);
  });

  it("rejects missing indicators, all-zero indicators, and missing density", () => {
    expect(isValidKbobMaterial({ ...base, ubp21Total: null })).toBe(false);
    expect(isValidKbobMaterial({ ...base, gwpTotal: 0, ubp21Total: 0, primaryEnergyNonRenewableTotal: 0 })).toBe(false);
    expect(isValidKbobMaterial({ ...base, density: "-" })).toBe(false);
    expect(isValidKbobMaterial({ ...base, density: 0 })).toBe(false);
  });
});

describe("layerEmissions", () => {
  it("is volume x density x indicator", () => {
    const kbob = { gwpTotal: 0.1, ubp21Total: 100, primaryEnergyNonRenewableTotal: 0.5 };
    expect(layerEmissions(2, 2300, kbob)).toEqual({ gwp: 460, ubp: 460_000, penre: 2300 });
  });

  it("is zero for unmatched materials", () => {
    expect(layerEmissions(2, 2300, undefined)).toEqual({ gwp: 0, ubp: 0, penre: 0 });
  });
});
