import express from "express";
import cors from "cors";
import generate from "./generator";
import simpleGit from "simple-git";
import path from "path";
import { getAllFiles } from "./files";
import dotenv from "dotenv";
import { uploadFile } from "./aws";
import {lPush} from './queue';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());


// uploadFile("athrv/test", "/Users/HP/Agyat.io/backend/dist/outputC9d768ti/assets/img/about.jpg")
// user yaha pe github ki repo ka url send krega frontend se
app.post("/deploy", async (req, res) => {
    const url = req.body.repoUrl; // ye user ka github ka url hoga
    const id = generate();
    const git_path = path.join(__dirname, `output/${id}`);
    await simpleGit().clone(url, git_path); // git repo ko locally clone krlia
    // console.log(url);
    const files = getAllFiles(git_path);
    // console.log(files);
    const uploadPromises = files
        .filter((file) => !file.includes(".git") && !file.includes(".git/"))
        .map(async (file) => {
            const fileName = file.slice(__dirname.length + 1).replace(/\\/g, "/");
            await uploadFile(fileName, file);
        });
    await Promise.all(uploadPromises);

    await lPush(id);
    res.json({
        id: id,
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
