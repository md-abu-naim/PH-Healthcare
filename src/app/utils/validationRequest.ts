import type { NextFunction, Request, Response } from "express"
import { catchAsync } from "./catchAsync"
import { AppError } from "./AppError"
import httpStatus from "http-status"
import type z from "zod";

export const validationRequest = (zodSchema: z.ZodObject) => {
    return catchAsync((req: Request, res: Response, next: NextFunction) => {
        const payload = req.body ?? {}

        const result = zodSchema.safeParse(payload);

        if (!result.success) {
            throw new AppError(httpStatus.BAD_REQUEST, result.error.issues[0].message)
        }

        req.body = req.body

        next()
    })
}