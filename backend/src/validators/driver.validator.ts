import { z } from "zod";

export const createDriverProfileSchema = z.object({
  licenseNumber: z
    .string()
    .min(5, "License number is required"),
});

export const createVehicleSchema = z.object({
  vehicleNumber: z
    .string()
    .min(3, "Vehicle number is required"),

  vehicleType: z.enum([
    "BIKE",
    "AUTO",
    "MINI",
    "SEDAN",
    "SUV",
  ]),

  brand: z.string().min(1, "Brand is required"),

  model: z.string().min(1, "Model is required"),

  color: z.string().optional(),

  capacity: z
    .number()
    .int()
    .positive("Capacity must be greater than 0"),
});

export const updateDriverStatusSchema = z.object({
  status: z.enum(["ONLINE", "OFFLINE"]),
});