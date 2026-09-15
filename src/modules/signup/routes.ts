import { Router } from "express";
import { signupController } from "./controller";
import { validate } from "../../middleware/validate";
import { signupSchema } from "./schemas";

const router = Router();

// Public -- a prospective customer has no account yet. Same class of
// unauthenticated endpoint as GET /api/companies.
router.post("/signup", validate(signupSchema), signupController);

export default router;
