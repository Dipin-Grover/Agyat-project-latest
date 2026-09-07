import { exec } from "child_process";
import path from "path";
import fs from "fs";

export function buildProject(id: string) {
    return new Promise((resolve, reject) => {
        const targetDir = path.join(__dirname, `output/${id}`);
        const pkgPath = path.join(targetDir, "package.json");

        let command = "";
        const npm = process.platform === "win32" ? "npm.cmd" : "npm";
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                const lockPath = path.join(targetDir, "package-lock.json");
                const installCommand = fs.existsSync(lockPath) ? "ci" : "install";
                if (pkg.scripts && pkg.scripts.build) {
                    command = `${npm} ${installCommand} --legacy-peer-deps --no-audit --no-fund --prefer-offline && ${npm} run build`;
                } else {
                    command = `${npm} ${installCommand} --legacy-peer-deps --no-audit --no-fund --prefer-offline`;
                }
            } catch (e) {
                command = `${npm} install --legacy-peer-deps --no-audit --no-fund --prefer-offline`;
            }
        } else {
            console.log("No package.json found - serving static files directly.");
            resolve("");
            return;
        }

        const child = exec(command, { cwd: targetDir, timeout: 10 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });

        let output = "";
        child.stdout?.on('data', function(data) {
            output += String(data);
            console.log('stdout: ' + data);
        });
        child.stderr?.on('data', function(data) {
            output += String(data);
            console.log('stderr: ' + data);
        });

        child.on('close', function(code) {
            if (code === 0) {
                resolve("");
            } else {
                const details = output.trim().slice(-4000);
                reject(new Error(`Build failed with exit code: ${code}${details ? `\n${details}` : ""}`));
            }
        });

        child.on('error', function(error) {
            reject(new Error(`Build process error: ${error.message}`));
        });
    });
}