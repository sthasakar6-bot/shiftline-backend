import { Router } from "express";
import { subscribeController, unsubscribeController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { subscribeSchema, unsubscribeSchema } from "./schemas";

const router = Router();

router.post("/push/subscribe", requireAuth, validate(subscribeSchema), subscribeController);
router.post("/push/unsubscribe", requireAuth, validate(unsubscribeSchema), unsubscribeController);

export default router;
