import { Router } from "express";
import {
  listEventsController,
  createEventController,
  updateEventController,
  deleteEventController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { createEventSchema, updateEventSchema } from "./schemas";

const router = Router();

router.get("/events", requireAuth, listEventsController);
router.post(
  "/events",
  requireAuth,
  requireRole("manager"),
  validate(createEventSchema),
  createEventController,
);
router.patch(
  "/events/:id",
  requireAuth,
  requireRole("manager"),
  validate(updateEventSchema),
  updateEventController,
);
router.delete("/events/:id", requireAuth, requireRole("manager"), deleteEventController);

export default router;
