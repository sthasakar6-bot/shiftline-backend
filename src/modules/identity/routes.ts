import { Router } from "express";
import {
  registerController,
  loginController,
  meController,
  changePasswordController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { registerSchema, loginSchema, changePasswordSchema } from "./schemas";

const router = Router();

router.post("/auth/register", validate(registerSchema), registerController);
router.post("/auth/login", validate(loginSchema), loginController);
router.get("/auth/me", requireAuth, meController);
router.patch(
  "/auth/password",
  requireAuth,
  validate(changePasswordSchema),
  changePasswordController,
);

export default router;
