import config from "../config"
import { redisClient } from "./redis"

export const getBkashIdToken = async () => {
    try {
        const idTokenKey = 'bkash:idToken'
        const refreshTokenKey = "bkash:refreshToken"

        let bkashIdToken = await redisClient.get(idTokenKey)
        const bkashIdTokenTTL = await redisClient.ttl(idTokenKey)
        let bkashRefreshToken = await redisClient.get(refreshTokenKey)

        if (bkashIdTokenTTL && bkashRefreshToken) {
            const refreshTokenResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/token/refresh`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    username: config.bkash_username,
                    password: config.bkash_password
                },
                body: JSON.stringify(
                    {
                        app_key: config.bkash_api_key,
                        app_secret: config.bkash_api_secret,
                        refresh_token: bkashRefreshToken
                    })
            })

            const bkashRefreshTokenResult = await refreshTokenResponse.json()

            bkashIdToken = bkashRefreshTokenResult.id_token as string

            await redisClient.set(idTokenKey, bkashIdToken, {
                expiration: {
                    type: 'EX',
                    value: 60 * 60
                }
            })

            return bkashIdToken
        }

        if (bkashIdToken) {
            return bkashIdToken
        }

        const response = await fetch(`${config.bkash_base_url}/tokenized/checkout/token/grant`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                username: config.bkash_username,
                password: config.bkash_password
            },
            body: JSON.stringify(
                {
                    app_key: config.bkash_api_key,
                    app_secret: config.bkash_api_secret
                })
        })

        if (!response.ok) {
            throw new Error("Bkash Access Token Grant Failed")
        }

        const result = await response.json()

        await redisClient.set(idTokenKey, result.id_token, {
            expiration: {
                type: "EX",
                value: 60 * 60
            }
        })

        await redisClient.set(refreshTokenKey, result.refresh_token, {
            expiration: {
                type: "EX",
                value: 60 * 60 * 24 * 28
            }
        })

        bkashIdToken = result.id_token

        return bkashIdToken
    } catch (error: any) {
        throw new Error(error.message)
    }
}