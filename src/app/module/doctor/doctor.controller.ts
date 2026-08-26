import httpStatus from "http-status";
import { DoctorServices } from "./doctor.services";
import { sendResponse } from "../../utils/sendResponse";
import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";


const applyAsDoctor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as {[fieldname: string]: Express.Multer.File[]}

    const resume = files?.['resume'] ? files['resume'][0] : null
    const additionalFiles = files?.['additionalFiles'] || null
    const data = JSON.stringify(req.body.data)

    console.log({resume, additionalFiles, data});
    
    const result = await DoctorServices.applyAsDoctor(data, resume, additionalFiles)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Appointment Cancelled & Refund Successfully",
        data: result,
    });
})

export const DoctorController = {
    applyAsDoctor
}