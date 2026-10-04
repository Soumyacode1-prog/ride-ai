import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import {
  createDriverProfile,
  addVehicle,
  getMyDriverProfile,
  updateDriverStatus,
  getRideRequests,
  getCurrentRide,
} from "../controllers/driver.controller";
const router = Router();

router.use(authenticate);
router.use(authorize("DRIVER"));

router.post("/profile", createDriverProfile);
router.post("/vehicles", addVehicle);
router.get("/me", getMyDriverProfile);
router.get(
  "/ride-requests",
  getRideRequests
);
router.get(
  "/current-ride",
  getCurrentRide
);
router.patch("/status", updateDriverStatus);
export default router;
