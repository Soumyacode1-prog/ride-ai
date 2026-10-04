import { Request, Response } from "express";
import pool from "../config/db";
import { createPaymentSchema, paymentWebhookSchema } from "../validators/payment.validator";



export const createPayment = async (
  req: Request,
  res: Response
) => {
  try {
    const validation =
      createPaymentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    const customerId = req.user?.userId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { rideId } = validation.data;

    // Get ride directly from database.
    const rideResult = await pool.query(
      `SELECT
          id,
          customer_id,
          final_fare,
          estimated_fare,
          status
       FROM rides
       WHERE id = $1`,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    const ride = rideResult.rows[0];

    // Customer can only pay for their own ride.
    if (ride.customer_id !== customerId) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot pay for this ride",
      });
    }

    // Payment only after ride completion.
    if (ride.status !== "COMPLETED") {
      return res.status(409).json({
        success: false,
        message:
          "Payment is only available after ride completion",
      });
    }

    // Check whether payment already exists.
    const existingPayment =
      await pool.query(
        `SELECT *
         FROM payments
         WHERE ride_id = $1`,
        [rideId]
      );

    if (existingPayment.rows.length > 0) {
      return res.status(200).json({
        success: true,
        message:
          "Payment already exists",
        payment:
          existingPayment.rows[0],
      });
    }

    /*
     * IMPORTANT:
     * Amount comes from database,
     * not req.body.
     */
    const amount =
      ride.final_fare ??
      ride.estimated_fare;

    if (amount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Ride does not have a payable fare",
      });
    }

    const result = await pool.query(
      `INSERT INTO payments (
          ride_id,
          customer_id,
          amount,
          payment_method,
          status
       )
       VALUES (
          $1,
          $2,
          $3,
          'MOCK',
          'PENDING'
       )
       RETURNING *`,
      [
        rideId,
        customerId,
        amount,
      ]
    );

    return res.status(201).json({
      success: true,
      message:
        "Payment initiated successfully",
      payment: result.rows[0],
    });
  } catch (error: any) {
    /*
     * Handles race condition where two
     * payment requests arrive together.
     */
    if (error?.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Payment already exists for this ride",
      });
    }

    console.error(
      "Create payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const paymentWebhook = async (
  req: Request,
  res: Response
) => {
  const client = await pool.connect();

  try {
    const validation =
      paymentWebhookSchema.safeParse(
        req.body
      );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload",
      });
    }

    const {
      eventId,
      paymentId,
      status,
    } = validation.data;

    await client.query("BEGIN");

    /*
     * STEP 1
     *
     * Record event.
     *
     * UNIQUE(event_id) guarantees the
     * same webhook cannot be processed twice.
     */
    const eventResult =
      await client.query(
        `INSERT INTO webhook_events (
            event_id,
            event_type,
            payload
         )
         VALUES (
            $1,
            'PAYMENT_STATUS_CHANGED',
            $2::jsonb
         )

         ON CONFLICT (event_id)
         DO NOTHING

         RETURNING id`,
        [
          eventId,
          JSON.stringify(req.body),
        ]
      );

    /*
     * No row returned means this event
     * was already processed.
     */
    if (eventResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(200).json({
        success: true,
        message:
          "Webhook already processed",
      });
    }

    /*
     * STEP 2
     *
     * Lock payment while updating.
     */
    const paymentResult =
      await client.query(
        `SELECT *
         FROM payments
         WHERE id = $1
         FOR UPDATE`,
        [paymentId]
      );

    if (paymentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const payment =
      paymentResult.rows[0];

    /*
     * Don't change a successful payment.
     *
     * Example:
     *
     * SUCCESS webhook
     * then delayed FAILED webhook
     *
     * We don't want SUCCESS -> FAILED.
     */
    if (payment.status === "SUCCESS") {
      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message:
          "Payment already successful",
      });
    }

    const providerPaymentId =
      `mock_${paymentId}`;

    await client.query(
      `UPDATE payments

       SET
         status = $1,
         provider_payment_id =
           COALESCE(
             provider_payment_id,
             $2
           ),
         updated_at =
           CURRENT_TIMESTAMP

       WHERE id = $3`,
      [
        status,
        providerPaymentId,
        paymentId,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message:
        `Payment ${status.toLowerCase()}`,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Payment webhook error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};

export const getPaymentByRide = async (
  req: Request,
  res: Response
) => {
  try {
    const customerId = req.user?.userId;
    const rideId = Number(req.params.rideId);

    if (!customerId) {
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

    const result = await pool.query(
      `SELECT
          id,
          ride_id,
          amount,
          payment_method,
          status,
          provider_payment_id,
          created_at
       FROM payments
       WHERE ride_id = $1
         AND customer_id = $2`,
      [
        rideId,
        customerId,
      ]
    );

    return res.status(200).json({
      success: true,
      payment:
        result.rows.length > 0
          ? result.rows[0]
          : null,
    });
  } catch (error) {
    console.error(
      "Get payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};