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

  private static async cleanup(filePath: string) {
    try {
      await fs.unlink(filePath);
      await fs.rmdir(path.dirname(filePath));
    } catch (error) {
      console.error("Failed to clean up temporary file:", error);
    }
  }

  private static async parseWithPython(
    filePath: string
  ): Promise<IFCParseResult> {
    const pythonProcess = spawn("python", [
      path.join(process.cwd(), "scripts/process_ifc.py"),
      filePath,
    ]);

    return new Promise((resolve, reject) => {
      let outputData = "";
      let errorData = "";

      pythonProcess.stdout.on("data", (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        errorData += data.toString();
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          resolve({ elements: [], error: errorData });
          return;
        }

        try {
          const result = JSON.parse(outputData);
          resolve({ elements: result.elements });
        } catch (error) {
          resolve({
            elements: [],
            error: "Failed to parse Python output",
          });
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
      const { elements, error } = await this.parseWithPython(tmpFile);

      if (error || elements.length === 0) {
        await prisma.upload.update({
          where: { id: uploadId },
          data: { status: "Failed", error },
        });
        return { id: uploadId, status: "Failed", elementCount: 0, error };
      }

      const batchSize = 2000;
      let processedCount = 0;

      for (let i = 0; i < elements.length; i += batchSize) {
        const batch = elements.slice(i, i + batchSize);

        await prisma.$transaction(
          async (tx) => {
            // First insert elements
            const elementValues = batch
              .map(
                (e) =>
                  `(gen_random_uuid(), '${e.guid}', '${
                    e.name?.replace(/'/g, "''") || ""
                  }', '${e.type}', ${e.volume || 0}, '${
                    e.buildingStorey || ""
                  }', '${projectId}', '${uploadId}')`
              )
              .join(",");

            await tx.$executeRawUnsafe(`
              INSERT INTO "Element" ("id", "guid", "name", "type", "volume", "buildingStorey", "projectId", "uploadId")
              VALUES ${elementValues}
              ON CONFLICT ("guid") 
              DO UPDATE SET 
                "name" = EXCLUDED."name",
                "type" = EXCLUDED."type",
                "volume" = EXCLUDED."volume",
                "buildingStorey" = EXCLUDED."buildingStorey"
              RETURNING id, guid
            `);

            // Create materials with null checks
            const materialsData = batch
              .flatMap((element) =>
                (element.materials || []).map((m) => ({
                  name: (m.name || "")?.replace(/'/g, "''"),
                  volume: m.volume || 0,
                  fraction: m.fraction || 0,
                  elementGuid: element.guid,
                }))
              )
              .filter((m) => m.name && m.elementGuid); // Filter out invalid materials

            if (materialsData.length > 0) {
              const materialValues = materialsData
                .map(
                  (m) =>
                    `(gen_random_uuid(), '${m.name}', ${m.volume}, ${m.fraction}, (
                      SELECT id FROM "Element" 
                      WHERE guid = '${m.elementGuid}' 
                      AND "uploadId" = '${uploadId}'
                      LIMIT 1
                    ))`
                )
                .join(",");

              await tx.$executeRawUnsafe(`
                INSERT INTO "Material" ("id", "name", "volume", "fraction", "elementId")
                SELECT m.id, m.name, m.volume, m.fraction, m.elementId
                FROM (
                  VALUES ${materialValues}
                ) AS m(id, name, volume, fraction, elementId)
                WHERE m.elementId IS NOT NULL
                ON CONFLICT DO NOTHING
              `);
            }

            processedCount += batch.length;
          },
          {
            timeout: 120000,
            maxWait: 20000,
          }
        );

        if (processedCount % 10000 === 0) {
          await prisma.upload.update({
            where: { id: uploadId },
            data: { elementCount: processedCount },
          });
        }
      }

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
        await IFCParserService.cleanup(tmpFile);
      }
    }
  }
}
