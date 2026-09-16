import { Router } from "express";
import { listMessagesController, createMessageController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { postMessageSchema } from "./schemas";

const router = Router();

router.get("/messages", requireAuth, listMessagesController);
router.post("/messages", requireAuth, validate(postMessageSchema), createMessageController);

export default router;
