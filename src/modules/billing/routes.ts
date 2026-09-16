import { Router } from "express";
import { checkoutController, addonCheckoutController, statusController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { checkoutSchema } from "./schemas";

const router = Router();

router.post(
  "/billing/checkout",
  requireAuth,
  requireRole("manager"),
  validate(checkoutSchema),
  checkoutController,
);
router.post("/billing/addon/checkout", requireAuth, requireRole("manager"), addonCheckoutController);
router.get("/billing/status", requireAuth, requireRole("manager"), statusController);

export default router;
