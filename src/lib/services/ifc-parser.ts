import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { prisma } from "@/lib/db";
import { IFCElement, IFCParseResult, UploadResult } from "@/lib/types/ifc";

export class IFCParserService {
  private static async createTempFile(buffer: Buffer): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ifc-"));
    const tmpFile = path.join(tmpDir, "temp.ifc");
    await fs.writeFile(tmpFile, buffer);
    return tmpFile;
  }

  private static async parseWithPython(
    filePath: string
  ): Promise<IFCParseResult> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn("python", [
        path.join(process.cwd(), "scripts/process_ifc.py"),
        filePath,
      ]);

      let outputData = "";
      let errorData = "";

      pythonProcess.stdout.on("data", (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        errorData += data.toString();
        console.error("Python error:", errorData);
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error("Python process failed with code:", code);
          resolve({ elements: [], error: errorData });
          return;
        }

        try {
          const result = JSON.parse(outputData);
          if (result.error) {
            resolve({ elements: [], error: result.error });
          } else {
            resolve({ elements: result.elements });
          }
        } catch (error) {
          console.error("Failed to parse Python output:", error);
          resolve({ elements: [], error: "Failed to parse Python output" });
        }
      });
    });
  }

  static async processIFCFile(
    file: Buffer,
    uploadId: string,
    projectId: string
  ): Promise<UploadResult> {
    let tmpFile: string | undefined;

    try {
      tmpFile = await this.createTempFile(file);
      console.log("Created temp file:", tmpFile);

      const { elements, error } = await this.parseWithPython(tmpFile);
      console.log("Parsed elements count:", elements.length);

      if (error || elements.length === 0) {
        console.error("IFC parsing error:", error);
        await prisma.upload.update({
          where: { id: uploadId },
          data: { status: "Failed", error },
        });
        return { id: uploadId, status: "Failed", elementCount: 0, error };
      }

      // Process elements in batches of 100
      const batchSize = 100;
      for (let i = 0; i < elements.length; i += batchSize) {
        const batch = elements.slice(i, i + batchSize);
        console.log(
          `Processing batch ${i / batchSize + 1} of ${Math.ceil(
            elements.length / batchSize
          )}`
        );

        await prisma.$transaction(
          async (tx) => {
            for (const element of batch) {
              // Try to find existing element
              const existingElement = await tx.element.findUnique({
                where: { guid: element.guid },
                include: { materials: true },
              });

              if (existingElement) {
                // Update existing element
                await tx.element.update({
                  where: { guid: element.guid },
                  data: {
                    name: element.name,
                    type: element.type,
                    volume: element.volume,
                    buildingStorey: element.buildingStorey,
                    projectId,
                    uploadId,
                    materials: {
                      // Delete existing materials
                      deleteMany: {},
                      // Create new materials
                      create: element.materials.map((material) => ({
                        name: material.name,
                        volume: material.volume,
                        fraction: material.fraction,
                      })),
                    },
                  },
                });
              } else {
                // Create new element
                await tx.element.create({
                  data: {
                    guid: element.guid,
                    name: element.name,
                    type: element.type,
                    volume: element.volume,
                    buildingStorey: element.buildingStorey,
                    projectId,
                    uploadId,
                    materials: {
                      create: element.materials.map((material) => ({
                        name: material.name,
                        volume: material.volume,
                        fraction: material.fraction,
                      })),
                    },
                  },
                });
              }
            }
          },
          {
            timeout: 30000, // 30 second timeout per batch
          }
        );
      }

      // Update upload status
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          status: "Completed",
          elementCount: elements.length,
        },
      });

      return {
        id: uploadId,
        status: "Completed",
        elementCount: elements.length,
      };
    } catch (error) {
      console.error("IFC processing error:", error);
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          status: "Failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    } finally {
      if (tmpFile) {
        try {
          await fs.unlink(tmpFile);
          await fs.rmdir(path.dirname(tmpFile));
        } catch (error) {
          console.error("Failed to clean up temporary file:", error);
        }
      }
    }
  }
}
