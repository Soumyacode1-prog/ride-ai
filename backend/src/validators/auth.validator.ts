import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must contain at least 2 characters"),

  email: z.string().email("Invalid email"),

  password: z
    .string()
    .min(6, "Password must contain at least 6 characters"),

  phone: z.string().optional(),

  role: z.enum(["CUSTOMER", "DRIVER"]).default("CUSTOMER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});