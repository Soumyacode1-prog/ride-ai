import { z } from "zod";

export const createRideSchema = z.object({
  pickupAddress: z
    .string()
    .trim()
    .min(3, "Pickup address is required"),

  dropAddress: z
    .string()
    .trim()
    .min(3, "Drop address is required"),
});