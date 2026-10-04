import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { rideRateLimit } from "../middleware/rateLimit.middleware";
import {
  createRide,
  getMyRides,
  acceptRide,
  rejectRide,
  driverArrived,
  startRide,
  completeRide,
} from "../controllers/ride.controller";

const router = Router();

router.use(authenticate);

// CUSTOMER

router.post(
  "/",
  authenticate,
  authorize("CUSTOMER"),
  rideRateLimit,
  createRide
);

router.get(
  "/my",
  authorize("CUSTOMER"),
  getMyRides
);

// DRIVER

router.post(
  "/:id/accept",
  authorize("DRIVER"),
  acceptRide
);

router.post(
  "/:id/reject",
  authorize("DRIVER"),
  rejectRide
);

router.patch(
  "/:id/arrived",
  authorize("DRIVER"),
  driverArrived
);

router.patch(
  "/:id/start",
  authorize("DRIVER"),
  startRide
);

router.patch(
  "/:id/complete",
  authorize("DRIVER"),
  completeRide
);

export default router;