import { Router } from "express";
import { registerUser } from "../controllers/user.controllers.js";
import {upload} from '../middlewares/multer.middlerware.js';
import {ApiError} from '../utils/ApiError.js';

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1,
        },
        {
            name:"coverImage",
            maxCount: 1,
        }
    ]),
    registerUser
    )


export default router;