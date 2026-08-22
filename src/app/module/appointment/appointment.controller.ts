import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentServices } from "./appointment.services";

const bookAppointment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body
    const user = req.user!

    const result = await AppointmentServices.bookAppointment(payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Appointment Booking Successfully",
        data: result,
    });
})

const bookAppointmentCallBack = catchAsync(async (req: Request, res: Response, next: NextFunction) => {


    const {redirectUrl} = await AppointmentServices.bookAppointmentCallBack(req.query)

    res.redirect(redirectUrl)

    // sendResponse(res, {
    //     statusCode: httpStatus.OK,
    //     success: true,
    //     message: "Appointment Booking Successfully",
    //     data: result,
    // });
})


export const AppointmentController = {
    bookAppointment, bookAppointmentCallBack
}