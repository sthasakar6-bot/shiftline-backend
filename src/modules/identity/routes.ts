import { Router } from "express";
import {
  loginController,
  meController,
  changePasswordController,
  updatePhoneController,
  completeOnboardingController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import {
  loginSchema,
  changePasswordSchema,
  updatePhoneSchema,
  completeOnboardingSchema,
} from "./schemas";

const router = Router();

router.post("/auth/login", validate(loginSchema), loginController);
router.get("/auth/me", requireAuth, meController);
router.patch(
  "/auth/password",
  requireAuth,
  validate(changePasswordSchema),
  changePasswordController,
);
router.patch("/auth/phone", requireAuth, validate(updatePhoneSchema), updatePhoneController);
router.patch(
  "/auth/complete-onboarding",
  requireAuth,
  validate(completeOnboardingSchema),
  completeOnboardingController,
);

export default router;
