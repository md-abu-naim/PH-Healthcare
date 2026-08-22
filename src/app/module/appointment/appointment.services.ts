import { AppointmentStatus } from "../../../generated/prisma/enums";
import config from "../../config"
import { getBkashIdToken } from "../../lib/bkash"
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

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

        return bkashCreatePaymentResult.bkashURL
    })

    return transactionResult
}

async function bookAppointmentCallBack(query: Record<string, any>) {
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
        return {
            executedPayment,
            redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`
        }
    }

    if (status === 'failure') {
        return {
            executedPayment,
            redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`
        }
    }

    if (status === 'cancel') {
        return {
            executedPayment,
            redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`
        }
    }

    return {
        executedPayment,
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments`
    }
}

export const AppointmentServices = {
    bookAppointment, bookAppointmentCallBack
}