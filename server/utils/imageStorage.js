const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

let client;
function enabled() { return Boolean(process.env.S3_BUCKET); }

function send(Command, values) {
  const endpoint = process.env.S3_ENDPOINT;
  client ??= new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint && { endpoint, forcePathStyle: true }),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client.send(new Command({ Bucket: process.env.S3_BUCKET, ...values }), {
    abortSignal: AbortSignal.timeout(15000),
  });
}

module.exports = {
  enabled,
  put: (Key, Body, ContentType) => send(PutObjectCommand, { Key, Body, ContentType }),
  get: (Key) => send(GetObjectCommand, { Key }),
  remove: (Key) => send(DeleteObjectCommand, { Key }),
};
