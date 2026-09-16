import { Router } from "express";
import multer from "multer";
import { signupController, purchaseCheckoutController, completeSignupController } from "./controller";
import { validate } from "../../middleware/validate";
import { signupSchema, purchaseCheckoutSchema, completeSignupSchema } from "./schemas";
import { AppError } from "../../errors/AppError";

// Mirrors the user-avatar upload config (user/routes.ts) -- memory storage,
// 3MB cap, images only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError(400, "The company logo must be an image file"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// Public -- a prospective customer has no account yet. Same class of
// unauthenticated endpoint as GET /api/companies. multer runs first so the
// text fields land in req.body as strings before Zod validates them.
router.post("/signup", upload.single("logo"), validate(signupSchema), signupController);

// Public -- reached from the marketing site's "Get Starter"/"Get Unlimited"
// buttons, before any account exists (or while one is logged out).
router.post("/signup/checkout", validate(purchaseCheckoutSchema), purchaseCheckoutController);
router.post(
  "/signup/complete",
  upload.single("logo"),
  validate(completeSignupSchema),
  completeSignupController,
);

export default router;
