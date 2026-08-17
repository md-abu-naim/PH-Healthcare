import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const uploadProfileImage = catchAsync(async(req: Request, res: Response, next: NextFunction) => {

    sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: null,
	});
})

export const UserController = {
    uploadProfileImage
}