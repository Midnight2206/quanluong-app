import assert from "node:assert/strict";
import {
  clearLocalUnsavedFieldRegistry,
  markLocalUnsavedField,
  unmarkLocalUnsavedField,
  listLocalUnsavedFields,
} from "./localUnsavedFieldRegistry.js";

clearLocalUnsavedFieldRegistry();
markLocalUnsavedField("/lttp", "issueDate");
markLocalUnsavedField("/lttp", "recipientName");
assert.deepEqual(listLocalUnsavedFields("/lttp").sort(), [
  "issueDate",
  "recipientName",
]);
unmarkLocalUnsavedField("/lttp", "issueDate");
assert.deepEqual(listLocalUnsavedFields("/lttp"), ["recipientName"]);
clearLocalUnsavedFieldRegistry();
assert.equal(listLocalUnsavedFields("/lttp").length, 0);
console.log("localUnsavedFieldRegistry: ok");
