import assert from "node:assert/strict";
import test from "node:test";
import {
  dishesJsonToPutMenuDishes,
  periodHasDishes,
} from "./kitchen-books-menu-sample-apply.js";

test("periodHasDishes true when dishes exist", () => {
  assert.equal(periodHasDishes({ trua: { dishes: [{ name: "A" }] } }, "trua"), true);
  assert.equal(periodHasDishes({ trua: { dishes: [] } }, "trua"), false);
});

test("dishesJsonToPutMenuDishes maps fields", () => {
  const dishes = dishesJsonToPutMenuDishes([
    {
      name: "A",
      sortOrder: 0,
      lines: [
        {
          commodityId: 1,
          calcMode: "per_person",
          perPersonAmount: 10,
          perPersonUnit: "g",
        },
      ],
    },
  ]);
  assert.equal(dishes[0].name, "A");
  assert.equal(dishes[0].lines[0].commodityId, 1);
});
