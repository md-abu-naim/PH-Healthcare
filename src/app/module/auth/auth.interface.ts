import type { Role } from "../../../generated/prisma/browser";

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterPatientPayload {
	name: string;
	email: string;
	password: string;
	patient: {
		contactNumber?: string
	}
}

export interface IVerifyPatientEmailPayload {
	email: string;
	otp: string
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

export interface IGoogleLoginPayload {
	idToken: string
}

export interface IForgotPasswarPayload {
	email: string
}

export interface IResetPasswarPayload {
	email: string,
	newPassword: string,
	otp: string
}