import { exec } from "child_process";
import path from "path";
import fs from "fs";

export function buildProject(id: string) {
    return new Promise((resolve, reject) => {
        const targetDir = path.join(__dirname, `output/${id}`);
        const pkgPath = path.join(targetDir, "package.json");

        let command = "";
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                if (pkg.scripts && pkg.scripts.build) {
                    command = process.platform === "win32" ? "npm.cmd install && npm.cmd run build" : "npm install && npm run build";
                } else {
                    command = process.platform === "win32" ? "npm.cmd install" : "npm install";
                }
            } catch (e) {
                command = process.platform === "win32" ? "npm.cmd install" : "npm install";
            }
        } else {
            console.log("No package.json found - serving static files directly.");
            resolve("");
            return;
        }

        const child = exec(command, { cwd: targetDir });

        child.stdout?.on('data', function(data) {
            console.log('stdout: ' + data);
        });
        child.stderr?.on('data', function(data) {
            console.log('stderr: ' + data);
        });

        child.on('close', function(code) {
            if (code === 0) {
                resolve("");
            } else {
                reject(new Error(`Build failed with exit code: ${code}`));
            }
        });

        child.on('error', function(error) {
            reject(new Error(`Build process error: ${error.message}`));
        });
    });
}