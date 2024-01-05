

import mongoose from "mongoose";

import { DB_name } from "../constants.js";

const connectDB = async () =>{
    try{
        const connectionInstance = await mongoose.connect(
          `${process.env.MONGODB_URL}/${DB_name}`
        );
        console.log("MongoDB Connected");
        console.log(`DB HOST::::${connectionInstance.connection.host}`);
    }catch(error){
        console.log("Mongo DB Connection Error",error);
        process.exit(1);
    }
}


export default connectDB;