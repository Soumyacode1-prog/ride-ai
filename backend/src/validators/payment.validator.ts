import { z } from "zod";

export const createPaymentSchema = z.object({
  rideId: z.number().int().positive(),
});

export const paymentWebhookSchema = z.object({
  eventId: z.string().min(1),

  paymentId: z.number().int().positive(),

  status: z.enum([
    "SUCCESS",
    "FAILED",
  ]),
});