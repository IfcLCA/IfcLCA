const Queue = require("bull");
const { processIfcFile } = require("./processIfcFile"); // Import your processing function

const ifcQueue = new Queue("ifcQueue", {
  redis: {
    host: "127.0.0.1",
    port: 6379,
  },
});

ifcQueue.process(async (job) => {
  const { filePath, projectId } = job.data;
  await processIfcFile(filePath, projectId);
});

module.exports = ifcQueue;
