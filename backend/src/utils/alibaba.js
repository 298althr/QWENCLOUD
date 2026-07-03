// backend/src/utils/alibaba.js
// Alibaba Cloud SDK integration — proof of deployment for Qwen Cloud Hackathon.
// Provides ECS instance listing, OSS audit-log backup, and Cloud Monitor custom metrics.
//
// Required env vars:
//   ALIBABA_CLOUD_ACCESS_KEY_ID
//   ALIBABA_CLOUD_ACCESS_KEY_SECRET
//   ALIBABA_CLOUD_REGION (e.g., ap-southeast-1)
//   ALIBABA_CLOUD_OSS_BUCKET (optional — defaults to althr-autopilot-logs)

const Ecs20140526 = require("@alicloud/ecs20140526").default;
const { Config: OpenApiConfig } = require("@alicloud/openapi-core");
const OSS = require("ali-oss");
const Cms20190101 = require("@alicloud/cms20190101").default;

const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
const region = process.env.ALIBABA_CLOUD_REGION || "ap-southeast-1";
const ossBucket = process.env.ALIBABA_CLOUD_OSS_BUCKET || "althr-autopilot-logs";

let ecsClient = null;
let ossClient = null;
let cmsClient = null;

function getEcsClient() {
  if (ecsClient) return ecsClient;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("ALIBABA_CLOUD_ACCESS_KEY_ID and ALIBABA_CLOUD_ACCESS_KEY_SECRET are required");
  }
  const config = new OpenApiConfig({
    accessKeyId,
    accessKeySecret,
    regionId: region,
    endpoint: `ecs.${region}.aliyuncs.com`,
  });
  ecsClient = new Ecs20140526(config);
  return ecsClient;
}

function getOssClient() {
  if (ossClient) return ossClient;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("ALIBABA_CLOUD_ACCESS_KEY_ID and ALIBABA_CLOUD_ACCESS_KEY_SECRET are required");
  }
  ossClient = new OSS({
    accessKeyId,
    accessKeySecret,
    region: `oss-${region}`,
    bucket: ossBucket,
  });
  return ossClient;
}

function getCmsClient() {
  if (cmsClient) return cmsClient;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("ALIBABA_CLOUD_ACCESS_KEY_ID and ALIBABA_CLOUD_ACCESS_KEY_SECRET are required");
  }
  const config = new OpenApiConfig({
    accessKeyId,
    accessKeySecret,
    regionId: region,
    endpoint: `metrics.${region}.aliyuncs.com`,
  });
  cmsClient = new Cms20190101(config);
  return cmsClient;
}

/**
 * List ECS instances in the configured region.
 * @returns {Promise<object>} DescribeInstancesResponse
 */
async function listEcsInstances() {
  const client = getEcsClient();
  const request = new Ecs20140526.DescribeInstancesRequest({
    regionId: region,
    pageSize: 50,
  });
  const response = await client.describeInstances(request);
  return response.body;
}

/**
 * Get the current ECS instance's metadata (proof of deployment).
 * @returns {Promise<object|null>} Instance metadata or null if not on ECS.
 */
async function getCurrentInstance() {
  try {
    const body = await listEcsInstances();
    const instances = body.instances?.instance || [];
    if (instances.length === 0) return null;
    return {
      instanceId: instances[0].instanceId,
      instanceType: instances[0].instanceType,
      regionId: instances[0].regionId,
      status: instances[0].status,
      creationTime: instances[0].creationTime,
    };
  } catch (e) {
    console.warn("[alibaba] listEcsInstances failed:", e.message);
    return null;
  }
}

/**
 * Upload audit log backup to OSS.
 * @param {string} key  Object key (e.g., "audit/2026-07-03.json")
 * @param {string|Buffer} data  Audit log content
 * @returns {Promise<object>} OSS upload result
 */
async function backupAuditLog(key, data) {
  const client = getOssClient();
  const result = await client.put(key, Buffer.isBuffer(data) ? data : Buffer.from(data));
  return result;
}

/**
 * Report a custom metric to Cloud Monitor (DQ score).
 * @param {string} metricName  e.g., "DecisionQualityScore"
 * @param {number} value  Metric value
 * @param {object} [dimensions]  Additional dimensions
 * @returns {Promise<object>} Cloud Monitor response
 */
async function reportDQScore(metricName, value, dimensions = {}) {
  const client = getCmsClient();
  const request = new Cms20190101.PutCustomMetricRequest({
    metricList: JSON.stringify([
      {
        metricName,
        dimensions: JSON.stringify({ ...dimensions, service: "althr-autopilot" }),
        values: JSON.stringify({ value }),
        count: 1,
        time: Date.now(),
        type: 1,
      },
    ]),
  });
  const response = await client.putCustomMetric(request);
  return response.body;
}

/**
 * Health check: verify all Alibaba Cloud services are reachable.
 * @returns {Promise<object>} { ecs, oss, cms } each "ok" or error message
 */
async function healthCheck() {
  const result = { ecs: "unknown", oss: "unknown", cms: "unknown" };

  try {
    await listEcsInstances();
    result.ecs = "ok";
  } catch (e) {
    result.ecs = e.message;
  }

  try {
    const client = getOssClient();
    await client.listBuckets();
    result.oss = "ok";
  } catch (e) {
    result.oss = e.message;
  }

  try {
    const client = getCmsClient();
    await client.describeMetricList(
      new Cms20190101.DescribeMetricListRequest({
        metricName: "CPUUtilization",
        namespace: "acs_ecs_dashboard",
        period: "60",
        startTime: new Date(Date.now() - 60000).toISOString(),
        endTime: new Date().toISOString(),
      })
    );
    result.cms = "ok";
  } catch (e) {
    result.cms = e.message;
  }

  return result;
}

module.exports = {
  listEcsInstances,
  getCurrentInstance,
  backupAuditLog,
  reportDQScore,
  healthCheck,
  getEcsClient,
  getOssClient,
  getCmsClient,
};
