import z from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6)
    .regex(/[A-Z]/, { message: "Add an uppercase letter" })
    .regex(/[a-z]/, { message: "Add a lowercase letter" })
    .regex(/[0-9]/, { message: "Add a number" }),
})