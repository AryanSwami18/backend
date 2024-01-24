import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error While Genrating Token");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  const { fullName, username, email, password } = req.body;

  if (
    [fullName, email, username, password].some((field) => field.trim() === "")
  ) {
    throw new ApiError(400, "All Fields Are Required");
  }

  const existedUserEmail = await User.findOne({ email });
  const existedUserUsername = await User.findOne({ username });
  if (existedUserEmail) {
    throw new ApiError(409, "Account Already Exists With The Email:", email);
  }
  if (existedUserUsername) {
    throw new ApiError(409, "The Username Is Already Taken");
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

  if (!avatarLocalPath) {
    throw new ApiError(400, "Upload A Avatar Image");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar Field Is Required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something Went Wrong While Creating the User");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Succesfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //req-data
  const { email, password } = req.body;
  //email based
  if (!email || email === "") {
    throw new ApiError(400, "Email and password is required");
  }
  //check user there with email
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User Does Not Exists");
  }
  //check the password

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "The Password is incorrect");
  }
  //access token and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  // send secure cookies
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Is Logged In"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }

  try {
    const decodedToken = Jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);

    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh Token Expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          accessToken,
          user.refreshToken,
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh Token");
  }
});

const changeUserPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassoword } = req.body;

  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      throw new ApiError(401, "Unauthorized Request");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
      throw new ApiError(401, "Invalid Old Password");
    }

    if (newPassword === confirmPassoword) {
      user.password = newPassword;
      await user.save({ validateBeforeSave: false });
    } else {
      throw new ApiError(401, "Confirm Password do not match");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password has been reset"));
  } catch (error) {
    throw new ApiError(
      401,
      error?.message || "Cannot Chnage The Password Try Again Later"
    );
  }
});

const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    return res
      .status(200)
      .json(ApiResponse(200, req.user, "User fetched Succesfully"));
  } catch (error) {
    throw new ApiError(501, error?.message || "Cannot fetch User");
  }
});

const updateAccountDetail = asyncHandler(async (req, res) => {
  try {
    const { fullName } = req.body;

    if (!fullName) {
      throw new ApiError(401, "Full Name Field is required");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          fullName: fullName,
        },
      },
      {
        new: true,
      }
    ).select("-passowrd -refreshToken");

    return res
      .status(200)
      .json(
        new ApiResponse(200, { user }, "Account Details Updated Succesfully")
      );
  } catch (error) {
    throw new ApiError(501, error?.message || "Cannot Update Account Details");
  }
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  try {
    const avatarLocalPath = req.file?.path;
  
    if (!avatarLocalPath) {
      throw new ApiError(401, "Avatar File Is Missing");
    }
  
    const avatar = await uploadOnCloudinary(avatarLocalPath);
  
    if (!avatar.url) {
      throw new ApiError(401, "Error While Uploading  Avatar File");
    }
  
   const user =  User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: avatar.url,
        },
      },
      { new: true }
    ).select("-password -refreshToken");
  
  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Account Avatar Updated Succesfully"));
  } catch (error) {
    fs.unlinkSync(avatarLocalPath);
  }
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  try {
    const CoverImageLocalPath = req.file?.path;

    if (!CoverImageLocalPath) {
      throw new ApiError(401, "Cover Image File Is Missing");
    }

    const CoverImage = await uploadOnCloudinary(avatarLocalPath);

    if (!CoverImage.url) {
      throw new ApiError(401, "Error While Uploading  Avatar File");
    }

    const user = User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          CoverImage: CoverImage.url,
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    return res
      .status(200)
      .json(
        new ApiResponse(200, { user }, "Account CoverImage Updated Succesfully")
      );
  } catch (error) {
    fs.unlinkSync(CoverImageLocalPath);
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  getCurrentUser,
  updateAccountDetail,
  updateUserAvatar,
  updateUserCoverImage,
};
