import { UploadApiResponse } from "cloudinary"
import { prisma } from "../../lib/prisma"
import { cloudinary } from "../../lib/cloudinary"
import bcrypt from "bcryptjs"
import { Role } from "../../../generated/prisma/enums"

const applyAsDoctor = async (payload: any, resume: Express.Multer.File | null, additionalFiles: Express.Multer.File[]) => {
    const isUserExists = await prisma.user.findUnique({
        where: {
            email: payload.email
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
            ).end(resume?.buffer)
        })
    }))

    const randomPassword = Math.random().toString(36).slice(-8);

    const hashedPassword = await bcrypt.hash(randomPassword, 8);

    const doctorApplication = await prisma.user.create({
        data: {
            ...payload.user,
            password: hashedPassword,
            role: Role.DOCTOR,
            doctor: {
                create: {
                    ...payload.doctor,
                    resumeUrl: resumeUploadLink.secure_url,
                    resumePublicId: resumeUploadLink.public_id,
                    additionalFiles: additionalFilesLinkUpload.map(file => ({
                        url: file.secure_url,
                        publicId: file.public_id
                    }))
                }
            }
        }
    })

    return doctorApplication
}

export const DoctorServices = {
    applyAsDoctor
}