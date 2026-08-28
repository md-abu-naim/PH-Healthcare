import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { UserServices } from "./user.services";
import { AppError } from "../../utils/AppError";

const uploadProfileImage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const buffer = req.file?.buffer
    const userId = req.user?.userId

    if (!buffer) {
        throw new AppError(httpStatus.BAD_REQUEST, "No File Provided")
    }

    const result = await UserServices.uploadProfileImagIntoCloudinary(buffer, userId as string)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User profile image updated successfully",
        data: result,
    });
})

export const UserController = {
    uploadProfileImage
}