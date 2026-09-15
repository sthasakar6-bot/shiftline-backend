import { Router } from "express";
import { stripeWebhookController, mollieWebhookController } from "./controller";

// Mounted in app.ts BEFORE express.json(), with express.raw() applied to
// this exact path -- both providers' signature verification needs the
// original, unparsed request bytes, and this app parses JSON globally for
// every other route.
const router = Router();

router.post("/stripe", stripeWebhookController);
router.post("/mollie", mollieWebhookController);

export default router;
