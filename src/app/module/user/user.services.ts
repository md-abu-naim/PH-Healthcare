import { cloudinary } from "../../lib/cloudinary"
import { prisma } from "../../lib/prisma";

const uploadProfileImagIntoCloudinary = async(buffer: Buffer, userId: string) => {
     cloudinary.uploader.upload_stream({
        resource_type: 'auto'
    },
    async (error, result) => {
        if(error){
            console.log(error);
            throw new Error(error.message)
        }
        
        const updatedUser = await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                imageUrl: result?.secure_url,
                imagePublicId: result?.public_id
            }
        })
    }
).end(buffer)

const user = await prisma.user.findUnique({
    where: {
        id: userId
    },
    omit: {
        password: true
    }
})

return user
}

export const UserServices = {
    uploadProfileImagIntoCloudinary
}