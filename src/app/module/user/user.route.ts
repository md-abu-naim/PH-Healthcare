import { Router } from "express";
import { UserController } from "./user.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.patch('/profile-image', upload.single('profileImage'), UserController.uploadProfileImage)

export const UserRoutes = router;
