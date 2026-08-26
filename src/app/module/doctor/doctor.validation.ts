import { z } from "zod";

export const applyDoctorZodSchema = z.object({
    user: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        role: z.literal("DOCTOR")
    }),

    doctor: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),

        address: z
            .string()
            .min(5, "Address must be at least 5 characters")
            .optional(),

        specializations: z
            .string()
            .min(2, "Specialization is required"),

        licensNumber: z
            .string()
            .min(3, "License number is required"),

        qualifications: z
            .string()
            .min(2, "Qualifications are required"),

        experienceYears: z
            .number()
            .int("Experience years must be an integer")
            .min(0, "Experience years cannot be negative"),

        bio: z
            .string()
            .min(10, "Bio must be at least 10 characters")
            .optional(),

        consultationFee: z
            .number()
            .min(0, "Consultation fee cannot be negative")
            .optional(),

        contactNumber: z
            .string()
            .regex(
                /^01[3-9]\d{8}$/,
                "Invalid Bangladeshi phone number"
            )
            .optional()
    })
});