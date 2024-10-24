const BuildingElement = require("./models/BuildingElement");
const Project = require("./models/Project");
const redis = require("ioredis");
const client = new redis();

async function processIfcFile(filePath, projectId) {
  try {
    // Simulate processing steps
    const totalSteps = 100;
    for (let step = 0; step <= totalSteps; step++) {
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update progress in Redis
      await client.set(`progress:${projectId}`, step);
    }

    // Finalize processing and update the database
    // Example: await BuildingElement.create({ ... });

    // Clear progress after completion
    await client.del(`progress:${projectId}`);
  } catch (error) {
    console.error("Error processing IFC file:", error);
    // Handle error and update progress to indicate failure
    await client.set(`progress:${projectId}`, "error");
  }
}

module.exports = { processIfcFile };
