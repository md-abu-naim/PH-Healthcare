import httpStatus from "http-status";
import { DoctorServices } from "./doctor.services";
import { sendResponse } from "../../utils/sendResponse";
import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";


const applyAsDoctor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as {[fieldname: string]: Express.Multer.File[]}

    const resume = files?.['resume'] ? files['resume'][0] : null
    const additionalFiles = files?.['additionalFiles'] || null
    const data = JSON.parse(req.body.data)

    
    const result = await DoctorServices.applyAsDoctor(data, resume, additionalFiles)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Apply As A Doctor Successfully",
        data: result,
    });
})

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body
    
    const result = await DoctorServices.verifyDoctorEmail(payload)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor Email Verified Successfully",
        data: result,
    });
})

const approveDoctor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body
    const user = req.user!
    
    const result = await DoctorServices.approveDoctor(payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor Approved Successfully",
        data: result,
    });
})

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {

	const {data, meta} = await DoctorServices.getAllDoctors(req.query)
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctors Retrieved Successfully",
		data: data,
		meta : meta,
	});
});

export const DoctorController = {
    applyAsDoctor, verifyDoctorEmail,
    approveDoctor, getAllDoctors
}