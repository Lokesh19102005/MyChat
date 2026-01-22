import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage config
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "chat_app_uploads",
    resource_type: "auto", // Automatically detect image/video/audio
    // allowed_formats: ["jpg", "jpeg", "png", "mp3", "wav", "mp4", "webm", "ogg"], // Optional: restrict formats
  },
});

const upload = multer({ storage });

export default upload;
