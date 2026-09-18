import { Router } from "express";
import { validate } from "../../middleware/validate";
import { requireIctAdmin } from "../../middleware/requireIctAdmin";
import { ictAdminLoginSchema, createTicketSchema, updateTicketStatusSchema } from "./schemas";
import {
  ictAdminLoginController,
  listTicketsController,
  createTicketController,
  updateTicketStatusController,
  monitoringController,
} from "./controller";

const router = Router();

// Public -- this IS the login. Everything else in this module requires the
// ICT-admin token it issues.
router.post("/ict-admin/login", validate(ictAdminLoginSchema), ictAdminLoginController);

router.get("/ict-admin/monitoring", requireIctAdmin, monitoringController);

router.get("/ict-admin/tickets", requireIctAdmin, listTicketsController);
router.post("/ict-admin/tickets", requireIctAdmin, validate(createTicketSchema), createTicketController);
router.patch(
  "/ict-admin/tickets/:id",
  requireIctAdmin,
  validate(updateTicketStatusSchema),
  updateTicketStatusController,
);

export default router;
