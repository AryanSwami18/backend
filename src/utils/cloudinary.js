import { v2 as cloudinary } from "cloudinary";
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadOnCloudinary = async(localFilePath)=>{
    try{
        if(!localFilePath){ 
            return null;
        }
        //upload the file 
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto",
        })
        //file has been uploaded succesfully
        console.log("file has been uploaded:::",response);
        return response;
    }catch(error){
        // removes the file  from the server  as the operation have failed to upload the file 
        fs.unlinkSync(localFilePath);
        return null;
    }
}


export {uploadOnCloudinary};