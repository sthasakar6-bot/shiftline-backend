import { Router } from "express";
import { listMessagesController, createMessageController, deleteMessageController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { postMessageSchema } from "./schemas";

const router = Router();

router.get("/messages", requireAuth, listMessagesController);
router.post("/messages", requireAuth, validate(postMessageSchema), createMessageController);
router.delete("/messages/:id", requireAuth, deleteMessageController);

export default router;
