import express from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { jobTitlesRouter } from "../modules/job-titles/job-titles.routes.js";
import { registrationsRouter } from "../modules/registrations/registrations.routes.js";
import { typesRouter } from "../modules/types/types.routes.js";
import { unitLevelMetadataRouter } from "../modules/unit-level-metadata/unit-level-metadata.routes.js";
import { unitLevelPermissionCapsRouter } from "../modules/unit-level-permission-caps/unit-level-permission-caps.routes.js";
import { unitsRouter } from "../modules/units/units.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";
import { permissionsRouter } from "../modules/permissions/permissions.routes.js";
import { lttpRouter } from "../modules/lttp/lttp.routes.js";
import { midnightSecretRouter } from "../modules/midnight-secret/midnight-secret.routes.js";
import { mealAllowanceRatesRouter } from "../modules/meal-allowance-rates/meal-allowance-rates.routes.js";
import { mealRosterRouter } from "../modules/meal-roster/meal-roster.routes.js";
import { chatRouter } from "../modules/chat/chat.routes.js";
import { respondSuccess } from "../shared/utils/responders.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  return respondSuccess(res, {
    message: "Backend is healthy",
    data: {
      status: "ok",
    },
  });
});

router.use("/auth", authRouter);
router.use("/job-titles", jobTitlesRouter);
router.use("/registrations", registrationsRouter);
router.use("/types", typesRouter);
router.use("/unit-level-metadata", unitLevelMetadataRouter);
router.use("/unit-level-permission-caps", unitLevelPermissionCapsRouter);
router.use("/units", unitsRouter);
router.use("/users", usersRouter);
router.use("/permissions", permissionsRouter);
router.use("/lttp", lttpRouter);
router.use("/midnight-secret", midnightSecretRouter);
router.use("/meal-allowance-rates", mealAllowanceRatesRouter);
router.use("/meal-roster", mealRosterRouter);
router.use("/chat", chatRouter);
/** Cùng handler — tương thích client/clone cũ gọi `/api/lrtp/*` sau khi đã deploy code mới. */
router.use("/lrtp", lttpRouter);

export { router };
