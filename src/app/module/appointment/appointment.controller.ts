import type { NextFunction, Request, Response } from "express";
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
        message: "ppointment Payment Initiated Successfully",
        data: result,
    });
})

const payAppointment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body
    const user = req.user!

    const result = await AppointmentServices.payAppointment(payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Appointment Payment Initiated Successfully",
        data: result,
    });
})

const cancelAppointment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body
    const user = req.user!

    const result = await AppointmentServices.cancelAppointment(payload, user)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Appointment Cancelled & Refund Successfully",
        data: result,
    });
})

const bookAppointmentCallBack = catchAsync(async (req: Request, res: Response, next: NextFunction) => {

    const {redirectUrl} = await AppointmentServices.bookAppointmentCallback(req.query)

    res.redirect(redirectUrl)

    // sendResponse(res, {
    //     statusCode: httpStatus.OK,
    //     success: true,
    //     message: "Appointment Booking Successfully",
    //     data: result,
    // });
})

const updateAppointmentStatus = catchAsync(
	async (req: Request, res: Response) => {
		const appointmentId = req.params.appointmentId as string;
		const payload = req.body;
		const user = req.user!;

		const result = await AppointmentServices.updateAppointmentStatus(
			appointmentId,
			payload,
			user,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Appointment Status Updated Successfully",
			data: result,
		});
	},
);

// const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
// 	const user = req.user!;

// 	const { data, meta } = await AppointmentServices.getMyAppointments(
// 		req.query,
// 		user,
// 	);
// 	sendResponse(res, {
// 		statusCode: httpStatus.OK,
// 		success: true,
// 		message: "Appointments Retrieved Successfully",
// 		data,
// 		meta,
// 	});
// });

// const getDoctorAppointments = catchAsync(
// 	async (req: Request, res: Response) => {
// 		const user = req.user!;

// 		const { data, meta } = await AppointmentServices.getDoctorAppointments(
// 			req.query,
// 			user,
// 		);
// 		sendResponse(res, {
// 			statusCode: httpStatus.OK,
// 			success: true,
// 			message: "Appointments Retrieved Successfully",
// 			data,
// 			meta,
// 		});
// 	},
// );

// const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
// 	const { data, meta } = await AppointmentServices.getAllAppointments(
// 		req.query,
// 	);
// 	sendResponse(res, {
// 		statusCode: httpStatus.OK,
// 		success: true,
// 		message: "Appointments Retrieved Successfully",
// 		data,
// 		meta,
// 	});
// });

// const getSingleAppointment = catchAsync(async (req: Request, res: Response) => {
// 	const appointmentId = req.params.appointmentId as string;
// 	const user = req.user!;

// 	const result = await AppointmentServices.getSingleAppointment(
// 		appointmentId,
// 		user,
// 	);
// 	sendResponse(res, {
// 		statusCode: httpStatus.OK,
// 		success: true,
// 		message: "Appointment Retrieved Successfully",
// 		data: result,
// 	});
// });

export const AppointmentController = {
    bookAppointment, payAppointment,
     bookAppointmentCallBack, cancelAppointment,
     updateAppointmentStatus
}