import z, { email, string } from "zod";

const PatientRegistationZod = z.object({
	name: z.string("Not A String !!!").min(3, "too Short"),
	email: z.email(),
	password: z.string().min(6)
	.regex(/[A-Z]/, { message: "Add an uppercase letter" })
	.regex(/[a-z]/, { message: "Add a lowercase letter" })
	.regex(/[0-9]/, { message: "Add a number" }),
	patient: z.object({
		contactNumber: z.string().optional()
	}).optional()
})

const patientLoginZod = z.object({
    email: z.email(),
    password: z.string().min(6)
	.regex(/[A-Z]/, { message: "Add an uppercase letter" })
	.regex(/[a-z]/, { message: "Add a lowercase letter" })
	.regex(/[0-9]/, { message: "Add a number" }),
})

const forgotPasswordZod = z.object({
	email: z.email()
})

const resetPasswordZOd = z.object({
    email: z.email(),
    newPassword: z.string().min(6)
	.regex(/[A-Z]/, { message: "Add an uppercase letter" })
	.regex(/[a-z]/, { message: "Add a lowercase letter" })
	.regex(/[0-9]/, { message: "Add a number" }),
	otp: z.string().length(6)
})

export const patientValidation = {
    PatientRegistationZod,
    patientLoginZod,
	forgotPasswordZod,
	resetPasswordZOd
}