import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { DoctorController } from "./doctor.controller";
import { auth } from "../../middleware/checkAuth";
import { upload } from "../../lib/multer";
import { validationRequest } from "../../utils/validationRequest";
import { applyDoctorZodSchema } from "./doctor.validation";

const router = Router();

router.post(
    '/apply-doctor',
    validationRequest(applyDoctorZodSchema),
    upload.fields([
        {
            name: "resume",
            maxCount: 1
        },
        {
            name: "additionalFiles",
            maxCount: 10
        }
    ]),
    DoctorController.applyAsDoctor
)

export const DoctorRoutes = router;