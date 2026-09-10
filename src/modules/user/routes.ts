import { Router } from "express";
import multer from "multer";
import {
  assignManagerController,
  createBookkeeperController,
  createEmployeeController,
  createManagerController,
  deactivateEmployeeController,
  getAvatarController,
  getEmployeesController,
  getFormerEmployeesController,
  getTeamController,
  getUsersController,
  getReportsController,
  promoteController,
  reactivateEmployeeController,
  removeManagerController,
  uploadAvatarController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { createEmployeeSchema } from "./schemas";
import { AppError } from "../../errors/AppError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError(400, "Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.get("/users", requireAuth, getUsersController);
router.get("/users/team", requireAuth, getTeamController);
router.post(
  "/users",
  requireAuth,
  requireRole("manager"),
  validate(createEmployeeSchema),
  createEmployeeController,
);
router.post(
  "/users/managers",
  requireAuth,
  requireRole("manager"),
  validate(createEmployeeSchema),
  createManagerController,
);
router.post(
  "/users/bookkeepers",
  requireAuth,
  requireRole("manager"),
  validate(createEmployeeSchema),
  createBookkeeperController,
);
router.get("/users/reports", requireAuth, requireRole("manager"), getReportsController);
router.get("/users/employees", requireAuth, requireRole("manager"), getEmployeesController);
router.get(
  "/users/former-employees",
  requireAuth,
  requireRole("manager"),
  getFormerEmployeesController,
);
router.post(
  "/users/:id/promote",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  promoteController,
);
router.patch(
  "/users/:id/manager",
  requireAuth,
  requireRole("manager"),
  assignManagerController,
);
router.delete(
  "/users/:id/manager",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  removeManagerController,
);
router.post(
  "/users/:id/deactivate",
  requireAuth,
  requireRole("manager"),
  deactivateEmployeeController,
);
router.post(
  "/users/:id/reactivate",
  requireAuth,
  requireRole("manager"),
  reactivateEmployeeController,
);
router.post("/users/me/avatar", requireAuth, upload.single("avatar"), uploadAvatarController);
router.get("/users/:id/avatar", requireAuth, getAvatarController);

export default router;
