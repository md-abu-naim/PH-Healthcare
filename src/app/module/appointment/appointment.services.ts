import { AppointmentStatus, PaymentStatus } from "../../../generated/prisma/enums";
import config from "../../config"
import { getBkashIdToken } from "../../lib/bkash"
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";

const bookAppointment = async (payload: any, user: RequestUser) => {

    const transactionResult = await prisma.$transaction(async (tx) => {
        const appointment = await tx.appointment.create({
            data: {
                status: AppointmentStatus.PENDING
            }
        })

        const bkashIdToken = await getBkashIdToken()

        if (!bkashIdToken) {
            throw new Error('No Bkash Access Token Found')
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
        throw new Error('Appointment does not exists')
    }

    if (existingAppointment.status === 'CONFIRMED') {
        throw new Error('Appointment already paid & confirmed')
    }

    if (existingAppointment.status === 'CANCELLED' || existingAppointment.status === 'ONGOING' || existingAppointment.status === 'COMPLETE') {
        throw new Error(`Appointment already ${existingAppointment.status}`)
    }


    const bkashIdToken = await getBkashIdToken()

    if (!bkashIdToken) {
        throw new Error('No Bkash Access Token Found')
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
            throw new Error("Payment Id Missing")
        }

        const status = query.status

        if (!status) {
            throw new Error('Payment Status is Missing')
        }

        const bkashIdToken = await getBkashIdToken()

        if (!bkashIdToken) {
            throw new Error('No Bkash Access Token Found')
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
            throw new Error('Appointment does not exists')
        }

        if (existingAppointment.status === 'ONGOING' || existingAppointment.status === 'COMPLETE') {
            throw new Error(`Appointment already ${existingAppointment.status}`)
        }

        if (existingAppointment.status === 'CANCELLED') {
            throw new Error('Appointment already cancelled')
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
            throw new Error('No Bkash Access Token Found')
        }

        const bkashRefundPaymentResponse = await fetch(`${config.bkash_base_url}/v2/tokenized-checkout/refund/payment/transaction`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bkashIdToken,
                "X-App-Key": config.bkash_app_key
            },
            body: JSON.stringify(
                {
                    paymentId: existingAppointment.payment?.bkashPaymentId,
                    trxId: existingAppointment.payment?.bkashTrxId,
                    refundAmount: existingAppointment.payment?.amount,
                    reason: "Patient Cancelled the Appointment"
                })
        })

        const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json()

        const updatedPayment = await tx.payment.update({
            where: {
                appointmentId: existingAppointment.id
            },
            data: {
                refundTrxId: bkashRefundPaymentResult.refundTrxId,
                refundAmount: bkashRefundPaymentResult.refundAmount,
                refundedAt: bkashRefundPaymentResult.completedTime,
                refundReason: bkashRefundPaymentResult.refundReason
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