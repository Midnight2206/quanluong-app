import express from "express";

import { respondOk } from "../../backend-response-system/templates/responders";
import { authenticateRequest } from "../templates/auth-middleware";
import { requirePermission } from "../templates/permission-middleware";

const router = express.Router();

router.get(
  "/users",
  authenticateRequest({
    jwtSecret: process.env.JWT_SECRET,
    sessionStore: {
      findById: async () => null,
    },
  }),
  requirePermission("users.read"),
  (_req, res) => {
    return respondOk(res, {
      message: "Protected route accessed.",
      data: null,
    });
  },
);

export default router;
