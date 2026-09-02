import { S3 } from "aws-sdk"; // aws software developement kit, ye S3 deta hai jisse hum s3 me sman dal ske
import fs from "fs";
import dotenv from 'dotenv';
dotenv.config();

// s3 ke bucket se connection
const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!
})

// local filepath mere device me current directory yani dist me jo github repo clone hui hai simple git se uska path hai
// filename wo path hai jaisa structure of folders and files mai s3 bucket me banana chahta hu because agr yhi se seedhi files gyi to vs code
// ka complex file structure s3 me copy hoga jo nhi chaiye so in s3 we create easier structure
export const uploadFile = async (fileName: string, localFilePath: string) => {
    const fileContent = fs.readFileSync(localFilePath);
    const response = await s3.upload({
        Body: fileContent,
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: fileName,
    }).promise();
    console.log(response);
}