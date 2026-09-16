import { Router } from "express";
import { mollieWebhookController } from "./controller";

// Mounted in app.ts BEFORE express.json(), with express.raw() applied to
// this exact path -- Mollie's signature verification needs the original,
// unparsed request bytes, and this app parses JSON globally for every
// other route.
const router = Router();

router.post("/mollie", mollieWebhookController);

export default router;
