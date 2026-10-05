import assert from "node:assert/strict";
import test from "node:test";
import { userAskQuestions, withUserAsk } from "./lttpIssueSlipAskQueue.js";

test("ticking a chosen line queues one question", () => {
  const lines = withUserAsk(
    [
      { draftLineId: 5, commodityId: 8, commodityName: "Trứng gà" },
      { draftLineId: 6, commodityId: null, commodityName: "gạo" },
    ],
    0,
  );
  assert.equal(lines[0].askUser, true);
  assert.equal(withUserAsk(lines, 1)[1].askUser, undefined);
  assert.deepEqual(userAskQuestions(lines), [
    {
      key: "user:5",
      lineIndex: 0,
      draftLineId: 5,
      text: "Trứng gà chưa đúng chỗ nào?",
    },
  ]);
});
