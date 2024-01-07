import { ApiError } from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {User} from '../models/user.models.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerUser = asyncHandler( async(req,res)=>{
    //get user details from frontend
    const {fullName,username,email,password} = req.body;
    console.log(fullName);

    if ([fullName,email,username,password].some((field)=> field.trim() === "")) {
        throw new ApiError(400,"All Fields Are Required");
    }

    const existedUserEmail = User.findOne({email});
    const existedUserUsername = User.findOne({username});
    if(existedUserEmail){
        throw new ApiError(409,"Account Already Exists With The Email:",email)
    }
    if (existedUserUsername) {
        throw new ApiError(409,"The Username Is Already Taken");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0].path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Upload  A Avatar Image");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar Field Is Required");
    }


    const user = await User.create(
        {
            fullName,
            avatar:avatar.url,
            coverImage:coverImage?.url || "",
            email,
            password,
            username:username.toLowerCase()
        }
    )

    const createdUser  = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new ApiError(500,"Something Went Wrong While Creating the User");
    }

    return res.status(200).json(
        new ApiResponse(200,createdUser,"User registered Succesfully")
    )

});


export {
    registerUser,
};