import { Router } from "express";
import {
  requestResetController,
  listPendingRequestsController,
  getResetTokenController,
  completeResetController,
  resolveResetRequestController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { requestResetSchema, completeResetSchema } from "./schemas";

const router = Router();

router.post(
  "/password-reset-requests",
  validate(requestResetSchema),
  requestResetController,
);
router.get(
  "/password-reset-requests",
  requireAuth,
  requireRole("manager"),
  listPendingRequestsController,
);
router.get("/password-reset-requests/:token", getResetTokenController);
router.post(
  "/password-reset-requests/:token/complete",
  validate(completeResetSchema),
  completeResetController,
);
router.post(
  "/password-reset-requests/:id/resolve",
  requireAuth,
  requireRole("manager"),
  validate(completeResetSchema),
  resolveResetRequestController,
);

export default router;
