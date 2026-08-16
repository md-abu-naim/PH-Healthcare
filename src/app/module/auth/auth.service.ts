import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { AuthProvider, Role, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgotPasswarPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswarPayload,
	IVerifyPatientEmailPayload,
} from "./auth.interface";
import { type TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth";
import crypto from 'crypto'
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import ejs from 'ejs'
import path from "path";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);

	const otp = crypto.randomInt(100000, 1000000)
	const otpKey = `patient-registation-otp:${email}`

	await redisClient.set(otpKey, otp, {
		expiration: {
			type: 'EX',
			value: 5 * 60
		}
	})

	const patientRegistationKey = `patient-registation-data:${email}`
	const redisUserPayload = {
		name, email, password: hashedPassword, patient: patientData
	}

	await redisClient.set(patientRegistationKey, JSON.stringify(redisUserPayload), {
		expiration: {
			type: 'EX',
			value: 5 * 60
		}
	})

	const tamplatePath = path.join(process.cwd(), 'src/app/tamplates/patient-registation-otp.ejs')

	const html = await ejs.renderFile(tamplatePath, {
		otp
	})

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "User Registation Verification Code",
		html
	})
};

const varifyPatientEmail = async(payload:IVerifyPatientEmailPayload ) => {
	const email = payload.email.trim().toLowerCase();
	const otp = payload.otp

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if(isUserExists?.status === "BLOCKED"){
		throw new Error('User is blocked')
	}

	if(isUserExists?.isDeleted || isUserExists?.status === 'DELETED'){
		throw new Error("User is deleted")
	}

	if(isUserExists?.emailVerified){
		throw new Error("User already verified")
	}

	const otpKey = `patient-registation-otp:${email}`

	const redisOtp = await redisClient.get(otpKey)

	if(!redisOtp){
		throw new Error('Invalid OTP')
	}

	if(redisOtp !== otp){
		throw new Error("OTP does not match")
	}

	await redisClient.del([otpKey])

	const patientRegistationKey = `patient-registation-data:${email}`
	const redisPatientData = await redisClient.get(patientRegistationKey)

	if(!redisPatientData){
		throw new Error('User Does not exists')
	}

	const patientPayload: IRegisterPatientPayload = JSON.parse(redisPatientData)

	const createdUser = await prisma.user.create({
		data: {
			name: patientPayload.name,
			email: patientPayload.email,
			password: patientPayload.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
			 create: { name: patientPayload.name,
			 email: patientPayload.email,
			 contactNumber: patientPayload?.patient?.contactNumber || "" },
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	await redisClient.del([patientRegistationKey])

	const tamplatePath = path.join(process.cwd(), 'src/app/tamplates/welcome-email.ejs')

	const html = await ejs.renderFile(tamplatePath, {
		name: createdUser.email
	})

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Welcome to PH Healthcare!",
		html
	})

	const { patient, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};
}

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	if(user.password === null && user.googleId !== null){
		throw new Error("User already has account registered with google. Try to google login")
	}

	const isPasswordMatched = await bcrypt.compare(password, user.password as string);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLoginIntoDB = async(payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id
		})

		googleIdTokenPayload = ticket.getPayload()
	} catch (error) {
		console.log("Google ID verification field", error);
		throw new Error("Invalid or Expired google ID Token")
	}

	if(!googleIdTokenPayload){
		throw new Error("Invalid or Expired google ID Token")
	}

	if(!googleIdTokenPayload.email){
		throw new Error('Email not fount')
	}

	if(!googleIdTokenPayload.name){
		throw new Error('Name not fount')
	}

	const isPatientExistingWithLogin = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			googleId: googleIdTokenPayload.sub
		}
	})

	let user = isPatientExistingWithLogin

	if(!isPatientExistingWithLogin){
		const isPatientExistingWithCredentials = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			authProvider: AuthProvider.CREDENTIAL
			}
		})

		if(isPatientExistingWithCredentials){
			if(!isPatientExistingWithCredentials.emailVerified){
				throw new Error("Email not verified")
			}
			if(isPatientExistingWithCredentials.status === UserStatus.BLOCKED){
				throw new Error("User Is Blocked")
			}
			if(isPatientExistingWithCredentials.isDeleted || isPatientExistingWithCredentials.status === UserStatus.DELETED){
				throw new Error("User is Deleted")
			}

			user = await prisma.user.update({
				where: {
					id: isPatientExistingWithCredentials.id
				},
				data: {
					googleId: googleIdTokenPayload.sub
				}
			})
		}else {
			user = await prisma.user.create({
			data: {
				name: googleIdTokenPayload.name,
				email: googleIdTokenPayload.email,
				role: Role.PATIENT,
				googleId: googleIdTokenPayload.sub,
				authProvider: AuthProvider.GOOGLE,
				emailVerified: true,
				patient: {
					create: {
						name: googleIdTokenPayload.name,
				        email: googleIdTokenPayload.email,
					}
				}
			}
		})

		const tamplatePath = path.join(process.cwd(), 'src/app/tamplates/welcome-email.ejs')

	const html = await ejs.renderFile(tamplatePath, {
		name: user.name
	})

	await transporter.sendMail({
		from: config.email_sender,
		to: user.email,
		subject: "Welcome to PH Healthcare!",
		html
	})
		}
	}

	if(!user){
		throw new Error("User not found")
	}

	if(user.status === UserStatus.BLOCKED){
				throw new Error("User Is Blocked")
	}
	if(user.isDeleted || user.status === UserStatus.DELETED){
				throw new Error("User is Deleted")
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
}

const forgotPassword = async(payload: IForgotPasswarPayload) => {
	const {email} = payload

	const isUserExists = await prisma.user.findUnique({
		where: {email}
	})

	if(!isUserExists){
		throw new Error("User Does not exists")
	}

	if(isUserExists.status === "BLOCKED"){
		throw new Error('User is blocked')
	}

	if(isUserExists.isDeleted || isUserExists.status === 'DELETED'){
		throw new Error("User is deleted")
	}

	if(!isUserExists.emailVerified){
		throw new Error("User not verified")
	}

	if(isUserExists.googleId || isUserExists.authProvider === 'GOOGLE'){
		throw new Error("User has account with google")
	}

	const otp = crypto.randomInt(100000, 1000000)
	const key = `forgot-password-otp:${isUserExists.email}`

	await redisClient.set(key, otp, {
		expiration: {
			type: 'EX',
			value: 5 * 60
		}
	})

	const tamplatePath = path.join(process.cwd(), 'src/app/tamplates/forgot-password.ejs')

	const html = await ejs.renderFile(tamplatePath, {
		otp
	})

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forgot Password Verification Code",
		// text: `Your OTP is: ${otp}`
		html
	})
}


const resetPassword = async(payload: IResetPasswarPayload) => {
   const {email, newPassword} = payload

	const isUserExists = await prisma.user.findUnique({
		where: {email}
	})

	if(!isUserExists){
		throw new Error("User Does not exists")
	}

	if(isUserExists.status === "BLOCKED"){
		throw new Error('User is blocked')
	}

	if(isUserExists.isDeleted || isUserExists.status === 'DELETED'){
		throw new Error("User is deleted")
	}

	if(!isUserExists.emailVerified){
		throw new Error("User not verified")
	}

	if(isUserExists.googleId || isUserExists.authProvider === 'GOOGLE'){
		throw new Error("User has account with google")
	}

	const key = `forgot-password-otp:${isUserExists.email}`

	const redisOtp = await redisClient.get(key)

	if(!redisOtp){
		throw new Error('Invalid OTP')
	}

	if(redisOtp !== payload.otp){
		throw new Error("OTP does not match")
	}

	const hassedPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds))

	await prisma.user.update({
		where: {
			email: isUserExists.email
		},
		data: {
			password: hassedPassword
		}
	})

	await redisClient.del([key])

	const tamplatePath = path.join(process.cwd(), 'src/app/tamplates/reset-password.ejs')

	const html = await ejs.renderFile(tamplatePath)

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forgot Password Verification Code",
		html
	})
}

export const AuthService = {
	registerPatient,
	loginUser, resetPassword,
	getMe, forgotPassword,
	refreshToken, varifyPatientEmail,
	googleLoginIntoDB
};
