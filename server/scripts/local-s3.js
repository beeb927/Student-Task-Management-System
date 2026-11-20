const fs = require("node:fs");
const path = require("node:path");
const S3rver = require("s3rver");

const directory = path.resolve(__dirname, "../.local-s3");
fs.mkdirSync(directory, { recursive: true });
const server = new S3rver({
  address: "127.0.0.1",
  port: 4569,
  directory,
  configureBuckets: [{ name: "task-manager-images" }],
});

server.run().then(() => {
  console.log("Local S3 listening at http://127.0.0.1:4569 (bucket: task-manager-images)");
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
