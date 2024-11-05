import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import { spawn } from "child_process";
import path from "path";

const prisma = new PrismaClient();

export class IfcProcessingService {
  async processIfc(
    filePath: string,
    uploadId: string,
    projectId: string
  ): Promise<void> {
    try {
      // Call Python script for IFC processing
      const pythonProcess = spawn("python", [
        path.join(process.cwd(), "scripts/process_ifc.py"),
        filePath,
      ]);

      let elements: any[] = [];

      pythonProcess.stdout.on("data", (data) => {
        try {
          // Parse IFC elements data from Python script
          const processedData = JSON.parse(data.toString());
          elements = processedData.elements;
        } catch (error) {
          console.error("Error parsing Python script output:", error);
        }
      });

      pythonProcess.stderr.on("data", (data) => {
        console.error("Python script error:", data.toString());
      });

      await new Promise((resolve, reject) => {
        pythonProcess.on("close", async (code) => {
          if (code !== 0) {
            reject(new Error("IFC processing failed"));
            return;
          }

          try {
            // Store elements in database
            await prisma.element.createMany({
              data: elements.map((element) => ({
                guid: element.guid,
                name: element.name,
                type: element.type,
                volume: element.volume,
                buildingStorey: element.buildingStorey,
                uploadId,
                projectId,
                materials: {
                  create: element.materials.map((material: any) => ({
                    name: material.name,
                    volume: material.volume,
                    fraction: material.fraction,
                  })),
                },
              })),
            });

            // Update upload status
            await prisma.upload.update({
              where: { id: uploadId },
              data: {
                status: "Completed",
                elementCount: elements.length,
              },
            });

            resolve(void 0);
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      await prisma.upload.update({
        where: { id: uploadId },
        data: { status: "Failed" },
      });
      throw error;
    }
  }
}
