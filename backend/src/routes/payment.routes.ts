import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

// import {
//   createPayment,
//   paymentWebhook,
// } from "../controllers/payment.controller";
import {
  createPayment,
  paymentWebhook,
  getPaymentByRide,
} from "../controllers/payment.controller";
const router = Router();

/*
 * Customer initiates payment.
 */
router.post(
  "/",
  authenticate,
  authorize("CUSTOMER"),
  createPayment
);

/*
 * Simulated external payment provider webhook.
 *
 * Real webhooks do NOT use customer JWT auth.
 */
router.get(
  "/ride/:rideId",
  authenticate,
  authorize("CUSTOMER"),
  getPaymentByRide
);
router.post(
  "/webhook",
  paymentWebhook
);

export default router;