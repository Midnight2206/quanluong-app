import assert from "node:assert/strict";
import test from "node:test";
import { assertStoredPassword } from "./stored-password.js";

test("hash null hoặc rỗng thì từ chối như đăng nhập sai", () => {
  for (const hash of [null, undefined, ""]) {
    assert.throws(
      () => assertStoredPassword(hash),
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, "UNAUTHORIZED");
        assert.equal(err.message, "Tên đăng nhập hoặc mật khẩu không đúng");
        return true;
      },
    );
  }
});

test("hash có giá trị thì không ném", () => {
  assert.doesNotThrow(() => assertStoredPassword("$2a$10$abc"));
});
