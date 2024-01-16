import { ApiError } from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {User} from '../models/user.models.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const generateAccessAndRefreshToken = async(userId)=>{
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken,refreshToken};

    }catch(error){
        throw new ApiError(500,"Error While Genrating Token");
    }
}

const registerUser = asyncHandler( async(req,res)=>{
    //get user details from frontend
    const {fullName,username,email,password} = req.body;

    if ([fullName,email,username,password].some((field)=> field.trim() === "")) {
        throw new ApiError(400,"All Fields Are Required");
    }

    const existedUserEmail = await User.findOne({email});
    const existedUserUsername = await User.findOne({username});
    if(existedUserEmail){
        throw new ApiError(409,"Account Already Exists With The Email:",email)
    }
    if (existedUserUsername) {
        throw new ApiError(409,"The Username Is Already Taken");
    }

    // const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0].path;

    let avatarLocalPath;
    let coverImageLocalPath;

    
if (
  req.files &&
  Array.isArray(req.files.avatar) &&
  req.files.avatar.length > 0
) {
  avatarLocalPath = req.files.avatar[0].path;
}

if (
  req.files &&
  Array.isArray(req.files.coverImage) &&
  req.files.coverImage.length > 0
) {
  coverImageLocalPath = req.files.coverImage[0].path;
}   



    if(!avatarLocalPath){
        throw new ApiError(400,"Upload A Avatar Image");
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

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Succesfully")
    )

});

const loginUser = asyncHandler(async(req,res)=>{
    //req-data
    const {email,password} = req.body;
    //email based
    if(!email || email === ''){
        throw new ApiError(400,"Email and password is required");
    }
    //check user there with email
    const user = await User.findOne({email});

    if(!user){
        throw new ApiError(404,"User Does Not Exists");
    }
    //check the password

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"The Password is incorrect");
    }
    //access token and refresh token 
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);
    // send secure cookies 
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure:true,
    }

    return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",refreshToken,options).json(new ApiResponse(200,{
        user:loggedInUser,accessToken,refreshToken
    },"User Is Logged In"));


});


const logoutUser = asyncHandler(async(req,res)=>{
    const userId = req.user._id;

        await User.findByIdAndUpdate(userId,{
            $set:{
                refreshToken:undefined
            },
        },{
            new:true
        }
    );

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200,{},"User Logged Out Successfully"));

});



export {
    registerUser,
    loginUser,
    logoutUser,
};