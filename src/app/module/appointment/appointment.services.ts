import { isBefore, isSameDay } from "date-fns";
import { AppointmentStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/enums";
import config from "../../config"
import { getBkashIdToken } from "../../lib/bkash"
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { IBookAppointmentPayload } from "./appoinment.interface";

const bookAppointment = async (payload: IBookAppointmentPayload, user: RequestUser) => {

    const transactionResult = await prisma.$transaction(async (tx) => {
        const patient = await prisma.patient.findUnique({
			where: { userId: user.userId },
		});

		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient Profile Not Found");
		}

		const schedule = await prisma.schedule.findUnique({
			where: { id: payload.scheduleId },
			include: { doctor: true },
		});

		if (!schedule || schedule.isDeleted) {
			throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found");
		}

		if (schedule.status !== ScheduleStatus.PUBLISHED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Is Not Published Yet",
			);
		}

		const now = new Date()

		if(!isSameDay(now, schedule.startDateTime)){
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Is Not Available Today",
			);
		}

		if(!isBefore(now, schedule.startDateTime)){
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Has Already Started",
			);
		}
		// if(isAfter(now, schedule.startDateTime)){
		// 	throw new AppError(
		// 		httpStatus.BAD_REQUEST,
		// 		"This Schedule Has Already Started",
		// 	);
		// }

		const existingAppointment = await prisma.appointment.findFirst({
			where : {
				patientId : patient.id,
				scheduleId : schedule.id,
				// status : { not : AppointmentStatus.CANCELLED }
			}
		})

		if(existingAppointment?.status === AppointmentStatus.PENDING){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Pending Appointment. Please Pay For That")
		}
		if(existingAppointment?.status === AppointmentStatus.CONFIRMED){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Confirmed Appointment.")
		}
		if(existingAppointment?.status === AppointmentStatus.ONGOING){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Ongoing Appointment")
		}
		if(existingAppointment?.status === AppointmentStatus.COMPLETE){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have Completed An Appointment On This Schedule. Please Try Again Another Day")
		}

		if(schedule.availableSlots === 0){
			throw new AppError(httpStatus.BAD_REQUEST, "This Schedule Is Fully Booked");
		}

		if(!schedule.doctor.consultationFee){
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Doctor Has Not Set A Consultation Fee Yet",
			);
		}

		const amount = schedule.doctor.consultationFee.toString();

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				patientId : patient.id,
				doctorId : schedule.doctor.id,
				scheduleId : schedule.id
			},
		});

        const bkashIdToken = await getBkashIdToken()

        if (!bkashIdToken) {
            throw new AppError(httpStatus.BAD_GATEWAY, 'No Bkash Access Token Found')
        }

        const bkashPaymentCreateResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bkashIdToken,
                "X-App-Key": config.bkash_app_key
            },
            body: JSON.stringify(
                {
                    mode: "0011",
                    payerReference: user.email,
                    callbackURL: `${config.bkash_callBack_url}/appointment/book-appointment/payment/callback`,
                    amount: amount,
                    currency: "BDT",
                    intent: "sale",
                    merchantInvoiceNumber: appointment.id
                })
        })

        const bkashCreatePaymentResult = await bkashPaymentCreateResponse.json()

        await tx.payment.create({
            data: {
                merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
                appointmentId: appointment.id,
                amount: '120',
                gatewayResponse: bkashCreatePaymentResult,
                bkashPaymentId: bkashCreatePaymentResult.paymentID,
                payerReference: user.email
            }
        })

        return {
            paymentUrl: bkashCreatePaymentResult.bkashURL
        }
    })

    return transactionResult
}

const payAppointment = async (payload: any, user: RequestUser) => {
    const appointmentId = payload.appointmentId

    const existingAppointment = await prisma.appointment.findUnique({
        where: {
            id: appointmentId
        }
    })

    if (!existingAppointment) {
        throw new AppError(httpStatus.NOT_FOUND, 'Appointment does not exists')
    }

    if (existingAppointment.status === 'CONFIRMED') {
        throw new AppError(httpStatus.BAD_REQUEST, 'Appointment already paid & confirmed')
    }

    if (existingAppointment.status === 'CANCELLED' || existingAppointment.status === 'ONGOING' || existingAppointment.status === 'COMPLETE') {
        throw new AppError(httpStatus.BAD_REQUEST, `Appointment already ${existingAppointment.status}`)
    }


    const bkashIdToken = await getBkashIdToken()

    if (!bkashIdToken) {
        throw new AppError(httpStatus.BAD_GATEWAY, 'No Bkash Access Token Found')
    }

    const bkashPaymentCreateResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bkashIdToken,
            "X-App-Key": config.bkash_app_key
        },
        body: JSON.stringify(
            {
                mode: "0011",
                payerReference: user.email,
                callbackURL: `${config.bkash_callBack_url}/appointment/book-appointment/payment/callback`,
                amount: "120",
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: existingAppointment.id
            })
    })

    const bkashCreatePaymentResult = await bkashPaymentCreateResponse.json()

    await prisma.payment.update({
        where: {
            appointmentId: existingAppointment.id
        },
        data: {
            merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
            gatewayResponse: bkashCreatePaymentResult,
            bkashPaymentId: bkashCreatePaymentResult.paymentID,
        }
    })

    return {
        paymentUrl: bkashCreatePaymentResult.bkashURL
    }
}

async function bookAppointmentCallBack(query: Record<string, any>) {
    const transactionResult = await prisma.$transaction(async (tx) => {
        const paymentId = query.paymentID || query.paymentId;

        if (!paymentId) {
            throw new AppError(httpStatus.BAD_REQUEST, "Payment Id Missing")
        }

        const status = query.status

        if (!status) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Payment Status is Missing')
        }

        const bkashIdToken = await getBkashIdToken()

        if (!bkashIdToken) {
            throw new AppError(httpStatus.BAD_GATEWAY, 'No Bkash Access Token Found')
        }

        const executedPaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bkashIdToken,
                "X-App-Key": config.bkash_app_key
            },
            body: JSON.stringify({
                paymentID: paymentId
            })
        })

        const executedPayment = await executedPaymentResponse.json()


        if (status === 'success') {
            await tx.appointment.update({
                where: {
                    id: executedPayment.merchantInvoiceNumber
                },
                data: {
                    status: AppointmentStatus.CONFIRMED
                }
            })

            await tx.payment.update({
                where: {
                    appointmentId: executedPayment.merchantInvoiceNumber,
                    bkashPaymentId: paymentId
                },
                data: {
                    status: PaymentStatus.PAID,
                    bkashTrxId: executedPayment.trxID,
                    paidAt: executedPayment.paymentExecuteTime,
                    gatewayResponse: executedPayment
                }
            })
            return {
                redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`
            }
        } else if (status === 'failure') {
            await tx.payment.update({
                where: {
                    bkashPaymentId: paymentId
                },
                data: {
                    status: PaymentStatus.FAILED,
                    gatewayResponse: executedPayment
                }
            })
            return {
                redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`
            }
        } else if (status === 'cancel') {
            await tx.payment.update({
                where: {
                    bkashPaymentId: paymentId
                },
                data: {
                    status: PaymentStatus.CANCELLED,
                    gatewayResponse: executedPayment
                }
            })
            return {
                redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`
            }
        } else {
            return {
                executedPayment,
                redirectUrl: `${config.frontend_url}/dashboard/my-appointments`
            }
        }
    })

    return transactionResult
}

const cancelAppointment = async (payload: any) => {
    const transactionResult = await prisma.$transaction(async (tx) => {
        const appointmentId = payload.appointmentId

        const existingAppointment = await tx.appointment.findUnique({
            where: {
                id: appointmentId
            },
            include: {
                payment: true
            }
        })

        if (!existingAppointment) {
            throw new AppError(httpStatus.NOT_FOUND, 'Appointment does not exists')
        }

    if (existingAppointment.status === 'ONGOING' || existingAppointment.status === 'COMPLETE') {
        throw new AppError(httpStatus.BAD_REQUEST, `Appointment already ${existingAppointment.status}`)
    }

    if (existingAppointment.status === 'CANCELLED') {
            throw new AppError(httpStatus.CONFLICT, 'Appointment already cancelled')
        }

        const updatedAppointment = await tx.appointment.update({
            where: {
                id: existingAppointment.id
            },
            data: {
                status: AppointmentStatus.CANCELLED
            }
        })

        const bkashIdToken = await getBkashIdToken()

        if (!bkashIdToken) {
            throw new AppError(httpStatus.BAD_GATEWAY, 'No Bkash Access Token Found')
        }

        const bkashRefundPaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/payment/refund`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bkashIdToken,
                "X-App-Key": config.bkash_app_key
            },
            body: JSON.stringify(
                {
                    paymentID: existingAppointment.payment?.bkashPaymentId,
                    trxID: existingAppointment.payment?.bkashTrxId,
                    amount: existingAppointment.payment?.amount.toString(),
                    sku: "Appointment Cancellation",
                    reason: "Patient Cancelled the Appointment"
                })
        })

        const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json()


        const updatedPayment = await tx.payment.update({
            where: {
                appointmentId: existingAppointment.id
            },
            data: {
                refundTrxId: bkashRefundPaymentResult.refundTrxID,
                refundAmount: bkashRefundPaymentResult.amount,
                refundedAt: bkashRefundPaymentResult.completedTime,
                refundReason: 'Patient Cancelled the Appointment',
                status: PaymentStatus.REFUNDED,
                gatewayResponse: bkashRefundPaymentResult
            }
        })

        return {
            appointment: updatedAppointment,
            payment: updatedPayment
        }
    })

    return transactionResult
}

export const AppointmentServices = {
    bookAppointment, payAppointment,
    bookAppointmentCallBack, cancelAppointment
}