import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary"
import { prisma } from "../../lib/prisma";

const uploadProfileImagIntoCloudinary = async (buffer: Buffer, userId: string) => {

    const uploadedResult = await new Promise<UploadApiResponse>((resolve, reject) => {
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
        ).end(buffer)
    })

    const updatedUser = await prisma.user.update({
        where: {
            id: userId
        },
        data: {
            imageUrl: uploadedResult.secure_url,
            imagePublicId: uploadedResult?.public_id
        },
        omit: {
            password: true
        }
    })

    return updatedUser
}

export const UserServices = {
    uploadProfileImagIntoCloudinary
}