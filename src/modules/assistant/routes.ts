import { Router } from "express";
import { chatController, confirmController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { chatSchema, confirmSchema } from "./schemas";

const router = Router();

router.post(
  "/assistant/chat",
  requireAuth,
  requireRole("manager"),
  validate(chatSchema),
  chatController,
);
router.post(
  "/assistant/confirm",
  requireAuth,
  requireRole("manager"),
  validate(confirmSchema),
  confirmController,
);

export default router;
