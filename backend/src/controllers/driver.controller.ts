import { Request, Response } from "express";
import pool from "../config/db";

import {
  createDriverProfileSchema,
  createVehicleSchema,
  updateDriverStatusSchema,
} from "../validators/driver.validator";


export const createDriverProfile = async (
  req: Request,
  res: Response
) => {
  try {
    const validation =
      createDriverProfileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const userId = req.user?.userId;

    const existingDriver = await pool.query(
      `SELECT id
       FROM drivers
       WHERE user_id = $1`,
      [userId]
    );

    if (existingDriver.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Driver profile already exists",
      });
    }

    const { licenseNumber } = validation.data;

    const result = await pool.query(
      `INSERT INTO drivers
       (user_id, license_number)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, licenseNumber]
    );

    return res.status(201).json({
      success: true,
      message: "Driver profile created successfully",
      driver: result.rows[0],
    });
  } catch (error: any) {
    console.error("Create driver profile error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "License number already registered",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const addVehicle = async (
  req: Request,
  res: Response
) => {
  try {
    const validation =
      createVehicleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const userId = req.user?.userId;

    const driverResult = await pool.query(
      `SELECT id
       FROM drivers
       WHERE user_id = $1`,
      [userId]
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Create driver profile first",
      });
    }

    const driverId = driverResult.rows[0].id;

    const {
      vehicleNumber,
      vehicleType,
      brand,
      model,
      color,
      capacity,
    } = validation.data;

    const result = await pool.query(
      `INSERT INTO vehicles
       (
         driver_id,
         vehicle_number,
         vehicle_type,
         brand,
         model,
         color,
         capacity
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        driverId,
        vehicleNumber,
        vehicleType,
        brand,
        model,
        color || null,
        capacity,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Vehicle added successfully",
      vehicle: result.rows[0],
    });
  } catch (error: any) {
    console.error("Add vehicle error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Vehicle number already registered",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const getMyDriverProfile = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    const driverResult = await pool.query(
      `SELECT
          d.id,
          d.license_number,
          d.license_verified,
          d.status,
          d.rating,
          d.total_rides,

          u.name,
          u.email,
          u.phone

       FROM drivers d

       JOIN users u
         ON u.id = d.user_id

       WHERE d.user_id = $1`,
      [userId]
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found",
      });
    }

    const driver = driverResult.rows[0];

    const vehiclesResult = await pool.query(
      `SELECT
          id,
          vehicle_number,
          vehicle_type,
          brand,
          model,
          color,
          capacity,
          verified,
          is_active
       FROM vehicles
       WHERE driver_id = $1
       ORDER BY created_at DESC`,
      [driver.id]
    );

    return res.status(200).json({
      success: true,

      driver: {
        ...driver,
        vehicles: vehiclesResult.rows,
      },
    });
  } catch (error) {
    console.error("Get driver profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const updateDriverStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const validation =
      updateDriverStatusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const userId = req.user?.userId;
    const { status } = validation.data;

    const result = await pool.query(
      `UPDATE drivers
       SET
         status = $1,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING
         id,
         status,
         updated_at`,
      [status, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Driver is now ${status}`,
      driver: result.rows[0],
    });
  } catch (error) {
    console.error("Update status error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const getRideRequests = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const driverResult = await pool.query(
      `SELECT id, status
       FROM drivers
       WHERE user_id = $1`,
      [userId]
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found",
      });
    }

    const driver = driverResult.rows[0];

    if (driver.status !== "ONLINE") {
      return res.status(400).json({
        success: false,
        message:
          "You must be online to receive ride requests",
      });
    }

    const rides = await pool.query(
      `SELECT
          r.id,
          r.pickup_address,
          r.drop_address,
          r.estimated_fare,
          r.status,
          r.requested_at,
          u.name AS customer_name

       FROM rides r

       JOIN users u
         ON u.id = r.customer_id

       WHERE r.status = 'SEARCHING'
         AND r.driver_id IS NULL

         AND NOT EXISTS (
           SELECT 1
           FROM ride_rejections rr
           WHERE rr.ride_id = r.id
             AND rr.driver_id = $1
         )

       ORDER BY r.requested_at ASC

       LIMIT 20`,
      [driver.id]
    );

    return res.status(200).json({
      success: true,
      rides: rides.rows,
    });
  } catch (error) {
    console.error("Get ride requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const getCurrentRide = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await pool.query(
      `SELECT
          r.id,
          r.pickup_address,
          r.drop_address,
          r.estimated_fare,
          r.final_fare,
          r.status,
          r.requested_at,
          r.accepted_at,
          r.arrived_at,
          r.started_at,

          u.name AS customer_name

       FROM rides r

       JOIN drivers d
         ON d.id = r.driver_id

       JOIN users u
         ON u.id = r.customer_id

       WHERE d.user_id = $1

         AND r.status IN (
           'DRIVER_ASSIGNED',
           'DRIVER_ARRIVED',
           'IN_PROGRESS'
         )

       ORDER BY r.created_at DESC

       LIMIT 1`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      ride:
        result.rows.length > 0
          ? result.rows[0]
          : null,
    });
  } catch (error) {
    console.error(
      "Get current ride error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};