import express from "express";

import { attachRequestContext } from "../templates/request-context";
import { requireAuthenticated } from "../templates/guard-middleware";

const router = express.Router();

router.get(
  "/me",
  attachRequestContext,
  requireAuthenticated(),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Request completed successfully.",
      data: { requestId: req.context.requestId },
    });
  },
);

export default router;
