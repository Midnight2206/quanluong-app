import express from "express";

const router = express.Router();

router.get("/users", listUsersController);
router.post("/users", createUserController);
router.get("/users/:id", getUserController);
router.patch("/users/:id", patchUserController);
router.put("/users/:id", putUserController);
router.delete("/users/:id", softDeleteUserController);

export default router;
