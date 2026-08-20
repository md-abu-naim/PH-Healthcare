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
                payerReference: "01723888888",
                callbackURL: `${config.bkash_callBack_url}/appointment/book-appointment/payment/callback`,
                amount: "120",
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: "Inv0124"
            })
    })

    const bkashCreatePaymentResult = await bkashPaymentCreateResponse.json()
    return bkashCreatePaymentResult
}

const bookAppointmentCallBack = () => {
    return {success: true}
}

export const AppointmentServices = {
    bookAppointment, bookAppointmentCallBack
}