import { Router } from "express";
import multer from "multer";
import {
  assignManagerController,
  getAvatarController,
  getEmployeesController,
  getUsersController,
  getReportsController,
  promoteController,
  removeManagerController,
  uploadAvatarController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";
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
router.get("/users/reports", requireAuth, requireRole("manager"), getReportsController);
router.get("/users/employees", requireAuth, requireRole("manager"), getEmployeesController);
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
router.post("/users/me/avatar", requireAuth, upload.single("avatar"), uploadAvatarController);
router.get("/users/:id/avatar", requireAuth, getAvatarController);

export default router;
