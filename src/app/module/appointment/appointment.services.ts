import config from "../../config"
import { getBkashIdToken } from "../../lib/bkash"

const bookAppointment = async () => {

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
                payerReference: "01723888198",
                callbackURL: `${config.bkash_callBack_url}/appointment/book-appointment/payment/callback`,
                amount: "120",
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: "Inv304"
            })
    })

    const bkashCreatePaymentResult = await bkashPaymentCreateResponse.json()
    return bkashCreatePaymentResult
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

    return executedPayment
}

export const AppointmentServices = {
    bookAppointment, bookAppointmentCallBack
}