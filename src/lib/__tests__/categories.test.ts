import { describe, expect, it } from "vitest";
import { buildAlerts } from "../alerts";
import { categoryNameKey, isCustomCategoryId, normalizeCategoryName, validateCategoryName } from "../categoryRules";
import { builtInCategoryByName, categories, categoryInfo, emptyBudget, existingCategoryByName, type CustomCategory } from "../data";
import { isCategoryId } from "../../models/Transaction";

const pet: CustomCategory = { id: `custom:${"a".repeat(24)}`, name: "Pet care" };

describe("validateCategoryName", () => {
  it("cleans spaces and returns the comparison key", () => {
    expect(validateCategoryName("  Pet   care ")).toEqual({ ok: true, name: "Pet care", key: "pet care" });
  });
  it("accepts names in other scripts", () => {
    expect(validateCategoryName("किराना").ok).toBe(true);
  });
  it.each([[""], ["   "], [null], [42], ["!!!"], ["x".repeat(31)], ["Income"], [" income "]])("rejects %j", (name) => {
    expect(validateCategoryName(name).ok).toBe(false);
  });
  it("treats capitals and spacing as the same name", () => {
    expect(categoryNameKey("PET  care ")).toBe(categoryNameKey(normalizeCategoryName("pet care")));
  });
});

describe("category ids", () => {
  it("accepts built-in ids and well-formed custom ids only", () => {
    expect(isCategoryId("food")).toBe(true);
    expect(isCategoryId(pet.id)).toBe(true);
    for (const bad of ["nope", "custom:", "custom:xyz", `custom:${"a".repeat(23)}`, `custom:${"A".repeat(24)}`, null, 7, "__proto__"]) {
      expect(isCategoryId(bad)).toBe(false);
    }
    expect(isCustomCategoryId("food")).toBe(false);
  });
});

describe("categoryInfo", () => {
  it("returns built-ins and custom names", () => {
    expect(categoryInfo("rent", [pet])).toBe(categories.rent);
    expect(categoryInfo(pet.id, [pet]).long).toBe("Pet care");
  });
  it.each([[`custom:${"b".repeat(24)}`], ["constructor"], ["__proto__"]])("shows %s as Other instead of crashing", (id) => {
    expect(categoryInfo(id, [pet])).toBe(categories.other);
  });
});

describe("finding a category by name", () => {
  it("matches built-in short and long names, ignoring capitals", () => {
    expect(builtInCategoryByName("RENT")).toBe("rent");
    expect(builtInCategoryByName("food & dining")).toBe("food");
    expect(builtInCategoryByName("other")).toBe("other");
  });
  it("doesn't match income or names that are new", () => {
    expect(builtInCategoryByName("Income")).toBeNull();
    expect(builtInCategoryByName("Pet care")).toBeNull();
  });
  it("finds the user's own category", () => {
    expect(existingCategoryByName(" pet CARE", [pet])).toBe(pet.id);
    expect(existingCategoryByName("Vet", [pet])).toBeNull();
  });
});

describe("budget reminders", () => {
  it("uses the custom category's name", () => {
    const alerts = buildAlerts({
      transactions: [{ id: "t", merchant: "Vet", category: pet.id, amount: -950, date: new Date().toISOString() }],
      transfers: [],
      loans: [],
      budget: { ...emptyBudget, categories: [{ category: pet.id, limit: 1000 }] },
      settings: { balanceAsOf: null },
      customCategories: [pet],
    });
    expect(alerts.map((a) => a.title).join()).toContain("Pet care budget");
  });
});
