import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function processIFCFile(fileBuffer: Buffer): Promise<any> {
  try {
    // Create temporary file
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ifc-"));
    const tmpFile = path.join(tmpDir, "temp.ifc");
    await fs.writeFile(tmpFile, fileBuffer);

    // Spawn Python process
    const pythonProcess = spawn("python", ["scripts/process_ifc.py", tmpFile]);

    return new Promise((resolve, reject) => {
      let outputData = "";
      let errorData = "";

      pythonProcess.stdout.on("data", (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        errorData += data.toString();
      });

      pythonProcess.on("close", async (code) => {
        // Clean up temp file
        await fs.rm(tmpDir, { recursive: true, force: true });

        if (code !== 0) {
          reject(new Error(`Python process failed: ${errorData}`));
          return;
        }

        try {
          const result = JSON.parse(outputData);
          resolve(result);
        } catch (error) {
          reject(new Error("Failed to parse Python output"));
        }
      });
    });
  } catch (error) {
    throw new Error(
      `Failed to process IFC file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
