import assert from "node:assert/strict";
import test from "node:test";
import { supplierOriginFromLocation } from "./supplierPortal.js";

test("supplier origin uses port 8082 next to the main and admin apps", () => {
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "8080" }),
    "http://localhost:8082",
  );
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "8081" }),
    "http://localhost:8082",
  );
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "3000" }),
    "http://localhost:3002",
  );
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "3001" }),
    "http://localhost:3002",
  );
});
