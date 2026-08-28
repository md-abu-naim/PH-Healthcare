import { UploadApiResponse } from "cloudinary"
import { prisma } from "../../lib/prisma"
import { cloudinary } from "../../lib/cloudinary"
import bcrypt from "bcryptjs"
import { DoctorVerificationStatus, Role } from "../../../generated/prisma/enums"
import crypto from 'crypto'
import { redisClient } from "../../lib/redis"
import path from "path"
import { transporter } from "../../lib/nodemailer"
import config from "../../config"
import ejs from 'ejs'
import { IApproveDoctorPayload } from "./doctor.interface"
import { RequestUser } from "../../middleware/checkAuth"

const applyAsDoctor = async (payload: any, resume: Express.Multer.File | null, additionalFiles: Express.Multer.File[]) => {
    const isUserExists = await prisma.user.findUnique({
        where: {
            email: payload.user.email
        }
    })

    if (isUserExists) {
        throw new Error('User already have account')
    }

    const resumeUploadLink = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader.upload_stream({
            resource_type: 'auto'
        },
            async (error, result) => {
                if (error) {
                    return reject(error.message)
                }

                if (!result) {
                    return reject(new Error("No Result Renturned"))
                }

                resolve(result)
            }
        ).end(resume?.buffer)
    })

    const additionalFilesLinkUpload = await Promise.all(additionalFiles.map((file) => {
        return new Promise<UploadApiResponse>((resolve, reject) => {
            cloudinary.uploader.upload_stream({
                resource_type: 'auto'
            },
                async (error, result) => {
                    if (error) {
                        return reject(error.message)
                    }

                    if (!result) {
                        return reject(new Error("No Result Renturned"))
                    }

                    resolve(result)
                }
            ).end(file?.buffer)
        })
    }))

    const randomPassword = Math.random().toString(36).slice(-8);

    const hashedPassword = await bcrypt.hash(randomPassword, 8);

    const doctorApplication = await prisma.user.create({
        data: {
            ...payload.user,
            password: hashedPassword,
            role: Role.DOCTOR,
            needPasswordChange: true,
            doctor: {
                create: {
                    ...payload.doctor,
                    resume: resumeUploadLink.secure_url,
                    resumePublicId: resumeUploadLink.public_id,
                    additionalFiles: additionalFilesLinkUpload.map(file => ({
                        url: file.secure_url,
                        publicId: file.public_id
                    }))
                }
            }
        },
        include: {
            doctor: true
        }
    })

    const otpKey = `doctor-application-otp:${payload.user.email}`
    const otp = crypto.randomInt(100000, 1000000)

    await redisClient.set(otpKey, otp, {
        expiration: {
            type: 'EX',
            value: 60 * 60
        }
    })

    const tamplatePath = path.join(process.cwd(), 'src/app/tamplates/patient-registation-otp.ejs')

    const html = await ejs.renderFile(tamplatePath, {
        otp
    })

    await transporter.sendMail({
        from: config.email_sender,
        to: payload.user.email,
        subject: "Doctor Email Verification Code",
        html
    })

    return doctorApplication
}

const verifyDoctorEmail = async (payload: any) => {
    const email = payload.email.trim().toLowerCase();
    const otp = payload.otp

    const isUserExists = await prisma.user.findUnique({
        where: { email, role: Role.DOCTOR },
    });

    if (!isUserExists) {
        throw new Error('Doctor Application not Found')
    }

    if (isUserExists?.emailVerified) {
        throw new Error("User already verified")
    }

    const otpKey = `doctor-application-otp:${email}`

    const redisOtp = await redisClient.get(otpKey)

    if (!redisOtp) {
        throw new Error('Invalid OTP')
    }

    if (redisOtp !== otp) {
        throw new Error("OTP does not match")
    }

    await redisClient.del([otpKey])

    const verifiedUser = await prisma.user.update({
        where: {
            id: isUserExists.id
        },
        data: {
            emailVerified: true
        },
        omit: { password: true },
        include: { doctor: true },
    });

    return verifiedUser
}

const approveDoctor = async(payload: IApproveDoctorPayload, reviewer: RequestUser) => {
    const { doctorId, verificationStatus, rejectionReason } = payload;

	const existingDoctor = await prisma.doctor.findUnique({
		where: { id: doctorId },
		include: { user: true },
	});

	if (!existingDoctor) {
		throw new Error( "Doctor Application Not Found");
	}

	if (existingDoctor.isDeleted) {
		throw new Error( "Doctor Application Has Been Deleted");
	}

	if (!existingDoctor.user.emailVerified) {
		throw new Error(
			"Doctor Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
		);
	}

	if (existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
		throw new Error(
			`Doctor Application Has Already Been ${existingDoctor.verificationStatus.toLowerCase()}`,
		);
	}

	if (
		verificationStatus === DoctorVerificationStatus.REJECTED &&
		!rejectionReason
	) {
		throw new Error(
			"Rejection Reason Is Required When Rejecting A Doctor Application",
		);
	}

    const updatedDoctor = await prisma.doctor.update({
		where: { id: doctorId },
		data: {
			verificationStatus,
			rejectionReason:
				verificationStatus === DoctorVerificationStatus.REJECTED
					? rejectionReason
					: null,
			reviewedBy: reviewer.userId,
			reviewedAt: new Date(),
		},
	});

    const isApproved = verificationStatus === DoctorVerificationStatus.APPROVED;

	const tempatePath = path.join(
		process.cwd(),
		`src/app/templates/${isApproved
			? "doctor-application-approved.ejs"
			: "doctor-application-rejected.ejs"
		}`,
	);



}

export const DoctorServices = {
    applyAsDoctor, verifyDoctorEmail,
    approveDoctor
}