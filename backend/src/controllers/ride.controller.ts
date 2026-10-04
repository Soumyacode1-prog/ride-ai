import { Request, Response } from "express";
import pool from "../config/db";
import { createRideSchema } from "../validators/ride.validator";
import { getIO } from "../config/socket";
export const createRide = async (
  req: Request,
  res: Response
) => {
  try {
    const validation = createRideSchema.safeParse(
      req.body
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const customerId = req.user?.userId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    /*
     * Don't allow customer to create another ride
     * while an active ride already exists.
     */
    const activeRide = await pool.query(
      `SELECT id
       FROM rides
       WHERE customer_id = $1
       AND status IN (
         'SEARCHING',
         'DRIVER_ASSIGNED',
         'DRIVER_ARRIVED',
         'IN_PROGRESS'
       )
       LIMIT 1`,
      [customerId]
    );

    if (activeRide.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "You already have an active ride",
      });
    }

    const {
      pickupAddress,
      dropAddress,
    } = validation.data;

    /*
     * Temporary fare for Phase 4.
     *
     * Later Maps will calculate distance and
     * the backend will calculate the real fare.
     *
     * Never trust a fare sent by the frontend.
     */
    const estimatedFare = 150;

    const result = await pool.query(
      `INSERT INTO rides (
        customer_id,
        pickup_address,
        drop_address,
        estimated_fare,
        status
      )
      VALUES ($1, $2, $3, $4, 'SEARCHING')
      RETURNING *`,
      [
        customerId,
        pickupAddress,
        dropAddress,
        estimatedFare,
      ]
    );

    // const ride = result.rows[0];
    const ride = result.rows[0];

// your ride_status_history logic...

const io = getIO();

io.to("drivers").emit(
  "ride:new",
  ride
);

return res.status(201).json({
  success: true,
  message:
    "Ride requested successfully",
  ride,
});
    await pool.query(
      `INSERT INTO ride_status_history (
        ride_id,
        status,
        changed_by
      )
      VALUES ($1, $2, $3)`,
      [
        ride.id,
        "SEARCHING",
        customerId,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Ride requested successfully",
      ride,
    });
  } catch (error) {
    console.error("Create ride error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const getMyRides = async (
  req: Request,
  res: Response
) => {
  try {
    const customerId = req.user?.userId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await pool.query(
      `SELECT
          r.*,

          u.name AS driver_name,

          v.vehicle_number,
          v.vehicle_type,
          v.brand,
          v.model

       FROM rides r

       LEFT JOIN drivers d
         ON d.id = r.driver_id

       LEFT JOIN users u
         ON u.id = d.user_id

       LEFT JOIN vehicles v
         ON v.driver_id = d.id
         AND v.is_active = TRUE

       WHERE r.customer_id = $1

       ORDER BY r.created_at DESC`,
      [customerId]
    );

    return res.status(200).json({
      success: true,
      rides: result.rows,
    });
  } catch (error) {
    console.error("Get rides error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const acceptRide = async (
  req: Request,
  res: Response
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user?.userId;
    const rideId = Number(req.params.id);

    if (!userId) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Number.isInteger(rideId)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
    }

    /*
     * Lock driver row.
     *
     * This prevents one driver from accepting
     * multiple rides simultaneously.
     */
    const driverResult = await client.query(
      `SELECT id, status
       FROM drivers
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    if (driverResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Driver profile not found",
      });
    }

    const driver = driverResult.rows[0];

    if (driver.status !== "ONLINE") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Driver is not available",
      });
    }

    /*
     * Claim the ride ONLY if it is still searching
     * and hasn't been assigned.
     */
    const rideResult = await client.query(
      `UPDATE rides

       SET
         driver_id = $1,
         status = 'DRIVER_ASSIGNED',
         accepted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP

       WHERE id = $2
         AND status = 'SEARCHING'
         AND driver_id IS NULL

       RETURNING *`,
      [driver.id, rideId]
    );

    if (rideResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          "Ride is no longer available",
      });
    }

    await client.query(
      `UPDATE drivers

       SET
         status = 'BUSY',
         updated_at = CURRENT_TIMESTAMP

       WHERE id = $1`,
      [driver.id]
    );

    await client.query(
      `INSERT INTO ride_status_history (
        ride_id,
        status,
        changed_by
      )
      VALUES ($1, $2, $3)`,
      [
        rideId,
        "DRIVER_ASSIGNED",
        userId,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Ride accepted successfully",
      ride: rideResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Accept ride error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};
export const rejectRide = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const rideId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Number.isInteger(rideId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
    }

    const driverResult = await pool.query(
      `SELECT id
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

    const driverId = driverResult.rows[0].id;

    const rideResult = await pool.query(
      `SELECT id
       FROM rides
       WHERE id = $1
         AND status = 'SEARCHING'
         AND driver_id IS NULL`,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ride is not available",
      });
    }

    await pool.query(
      `INSERT INTO ride_rejections (
        ride_id,
        driver_id
      )
      VALUES ($1, $2)

      ON CONFLICT (ride_id, driver_id)
      DO NOTHING`,
      [rideId, driverId]
    );

    return res.status(200).json({
      success: true,
      message: "Ride rejected",
    });
  } catch (error) {
    console.error("Reject ride error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
const updateRideStatus = async (
  userId: number,
  rideId: number,
  currentStatus: string,
  nextStatus: string,
  timestampColumn: string
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const driverResult = await client.query(
      `SELECT id
       FROM drivers
       WHERE user_id = $1`,
      [userId]
    );

    if (driverResult.rows.length === 0) {
      throw new Error("DRIVER_NOT_FOUND");
    }

    const driverId = driverResult.rows[0].id;

    const allowedTimestampColumns = [
      "arrived_at",
      "started_at",
    ];

    if (!allowedTimestampColumns.includes(timestampColumn)) {
      throw new Error("INVALID_TIMESTAMP_COLUMN");
    }

    const rideResult = await client.query(
      `UPDATE rides
       SET
         status = $1,
         ${timestampColumn} = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP

       WHERE id = $2
         AND driver_id = $3
         AND status = $4

       RETURNING *`,
      [
        nextStatus,
        rideId,
        driverId,
        currentStatus,
      ]
    );

    if (rideResult.rows.length === 0) {
      throw new Error("INVALID_RIDE_STATE");
    }

    await client.query(
      `INSERT INTO ride_status_history (
        ride_id,
        status,
        changed_by
      )
      VALUES ($1, $2, $3)`,
      [
        rideId,
        nextStatus,
        userId,
      ]
    );

    await client.query("COMMIT");

    return rideResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
export const driverArrived = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user!.userId;
    const rideId = Number(req.params.id);

    if (!Number.isInteger(rideId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
    }

    const ride = await updateRideStatus(
      userId,
      rideId,
      "DRIVER_ASSIGNED",
      "DRIVER_ARRIVED",
      "arrived_at"
    );

    return res.json({
      success: true,
      message: "Driver arrived",
      ride,
    });
  } catch {
    return res.status(409).json({
      success: false,
      message: "Ride cannot be marked as arrived",
    });
  }
};
export const startRide = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user!.userId;
    const rideId = Number(req.params.id);

    if (!Number.isInteger(rideId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
    }

    const ride = await updateRideStatus(
      userId,
      rideId,
      "DRIVER_ARRIVED",
      "IN_PROGRESS",
      "started_at"
    );

    return res.json({
      success: true,
      message: "Ride started",
      ride,
    });
  } catch {
    return res.status(409).json({
      success: false,
      message: "Ride cannot be started",
    });
  }
};
export const completeRide = async (
  req: Request,
  res: Response
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user?.userId;
    const rideId = Number(req.params.id);

    if (!userId) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Number.isInteger(rideId)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
    }

    const driverResult = await client.query(
      `SELECT id
       FROM drivers
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    if (driverResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Driver profile not found",
      });
    }

    const driverId = driverResult.rows[0].id;

    const rideResult = await client.query(
      `UPDATE rides

       SET
         status = 'COMPLETED',
         final_fare = estimated_fare,
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP

       WHERE id = $1
         AND driver_id = $2
         AND status = 'IN_PROGRESS'

       RETURNING *`,
      [rideId, driverId]
    );

    if (rideResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Ride cannot be completed",
      });
    }

    await client.query(
      `UPDATE drivers

       SET
         status = 'ONLINE',
         total_rides = total_rides + 1,
         updated_at = CURRENT_TIMESTAMP

       WHERE id = $1`,
      [driverId]
    );

    await client.query(
      `INSERT INTO ride_status_history (
        ride_id,
        status,
        changed_by
      )
      VALUES ($1, 'COMPLETED', $2)`,
      [rideId, userId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Ride completed successfully",
      ride: rideResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Complete ride error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};