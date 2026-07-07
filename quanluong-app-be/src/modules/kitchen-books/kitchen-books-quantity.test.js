import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommodityCalcMode,
  computeLineTotalQuantity,
} from "./kitchen-books-quantity.js";

test("classify gói as per_unit_shared", () => {
  assert.equal(classifyCommodityCalcMode("Gói"), "per_unit_shared");
});

test("per_person g to kg", () => {
  const r = computeLineTotalQuantity({
    calcMode: "per_person",
    perPersonAmount: 150,
    perPersonUnit: "g",
    peoplePerUnit: null,
    headcount: 128,
  });
  assert.equal(r.totalQuantity, 19.2);
  assert.equal(r.totalUnit, "kg");
});

test("per_unit_shared ceil", () => {
  const r = computeLineTotalQuantity({
    calcMode: "per_unit_shared",
    perPersonAmount: null,
    perPersonUnit: null,
    peoplePerUnit: 8,
    headcount: 130,
    commodityMeasureUnit: "hộp",
  });
  assert.equal(r.totalQuantity, 17);
  assert.equal(r.totalUnit, "hộp");
});
