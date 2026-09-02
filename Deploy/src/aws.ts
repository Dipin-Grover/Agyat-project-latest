import { S3 } from "aws-sdk";
import fs from "fs";
import path from "path";
import dotenv from 'dotenv';
dotenv.config();

const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!
})

export async function downloadS3Folder(prefix: string) {
    const allFiles = await s3.listObjectsV2({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Prefix: prefix
    }).promise();
    
    const allPromises = allFiles.Contents?.map(async ({Key}) => {
        return new Promise<void>((resolve) => {
            if (!Key || Key.endsWith("/")) {
                resolve();
                return;
            }
            const finalOutputPath = path.join(__dirname, Key);
            const dirName = path.dirname(finalOutputPath);
            if (!fs.existsSync(dirName)){
                fs.mkdirSync(dirName, { recursive: true });
            }
            const outputFile = fs.createWriteStream(finalOutputPath);
            const readStream = s3.getObject({
                Bucket: process.env.AWS_BUCKET_NAME!,
                Key
            }).createReadStream();

            readStream.on("error", (err) => {
                console.error(`Download error for ${Key}:`, err);
                resolve();
            });
            outputFile.on("error", (err) => {
                console.error(`Write error for ${finalOutputPath}:`, err);
                resolve();
            });
            outputFile.on("finish", () => {
                resolve();
            });

            readStream.pipe(outputFile);
        })
    }) || []
    console.log("awaiting download completion");

    await Promise.all(allPromises);
}

export async function copyFinalDist(id: string) {
    let folderPath = path.join(__dirname, `output/${id}/dist`);
    if (!fs.existsSync(folderPath)) {
        folderPath = path.join(__dirname, `output/${id}/build`);
    }
    if (!fs.existsSync(folderPath)) {
        folderPath = path.join(__dirname, `output/${id}`);
    }
    if (!fs.existsSync(folderPath)) {
        console.error(`Build output directory does not exist for ${id}`);
        return;
    }
    const allFiles = getAllFiles(folderPath);
    const promises = allFiles
        .filter(file => !file.includes("node_modules") && !file.includes(".git"))
        .map(file => {
            const relativePath = file.slice(folderPath.length + 1).replace(/\\/g, '/');
            return uploadFile(`dist/${id}/` + relativePath, file);
        });
    console.log(`Uploading ${promises.length} files to S3 for ${id}...`);
    await Promise.all(promises);
    console.log(`Finished uploading ${promises.length} files to S3 for dist/${id}`);
}

const getAllFiles = (folderPath: string) => {
    let response: string[] = [];

    const allFilesAndFolders = fs.readdirSync(folderPath);allFilesAndFolders.forEach(file => {
        const fullFilePath = path.join(folderPath, file);
        if (fs.statSync(fullFilePath).isDirectory()) {
            response = response.concat(getAllFiles(fullFilePath))
        } else {
            response.push(fullFilePath);
        }
    });
    return response;
}

export const uploadFile = async (fileName: string, localFilePath: string) => {
    const fileContent = fs.readFileSync(localFilePath);
    const response = await s3.upload({
        Body: fileContent,
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: fileName,
    }).promise();
    // console.log(response);
}