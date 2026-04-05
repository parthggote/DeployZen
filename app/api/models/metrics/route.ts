import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

/**
 * Aggregates inference metrics from the inference_metrics collection.
 * Returns total requests, avg latency, error rate, per-model breakdown,
 * and a 24h latency trend.
 * @returns {NextResponse} JSON with aggregated metrics
 */
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")
    const metricsCol = db.collection("inference_metrics")

    const totalDocs = await metricsCol.countDocuments()

    if (totalDocs === 0) {
      return NextResponse.json({
        success: true,
        metrics: {
          totalRequests: 0,
          avgLatencyMs: 0,
          errorRate: 0,
          perModel: [],
          latencyTrend: [],
        },
      })
    }

    const overallAgg = await metricsCol
      .aggregate([
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            avgLatencyMs: { $avg: "$latencyMs" },
            errorCount: { $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] } },
          },
        },
      ])
      .toArray()

    const overall = overallAgg[0] || { totalRequests: 0, avgLatencyMs: 0, errorCount: 0 }
    const errorRate = overall.totalRequests > 0 ? (overall.errorCount / overall.totalRequests) * 100 : 0

    const perModelAgg = await metricsCol
      .aggregate([
        {
          $group: {
            _id: "$modelId",
            modelName: { $first: "$modelName" },
            huggingFaceModelId: { $first: "$huggingFaceModelId" },
            task: { $first: "$task" },
            requestCount: { $sum: 1 },
            avgLatencyMs: { $avg: "$latencyMs" },
            errorCount: { $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] } },
            lastError: { $last: { $cond: [{ $eq: ["$success", false] }, "$error", null] } },
          },
        },
        { $sort: { requestCount: -1 } },
      ])
      .toArray()

    const perModel = perModelAgg.map((m) => ({
      modelId: m._id?.toString(),
      modelName: m.modelName,
      huggingFaceModelId: m.huggingFaceModelId,
      task: m.task,
      requestCount: m.requestCount,
      avgLatencyMs: Math.round(m.avgLatencyMs),
      errorCount: m.errorCount,
      lastError: m.lastError,
    }))

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const trendAgg = await metricsCol
      .aggregate([
        { $match: { timestamp: { $gte: twentyFourHoursAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%dT%H:00:00Z", date: "$timestamp" },
            },
            avgLatencyMs: { $avg: "$latencyMs" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    const latencyTrend = trendAgg.map((t) => ({
      hour: t._id,
      avgLatencyMs: Math.round(t.avgLatencyMs),
      requestCount: t.count,
    }))

    return NextResponse.json({
      success: true,
      metrics: {
        totalRequests: overall.totalRequests,
        avgLatencyMs: Math.round(overall.avgLatencyMs),
        errorRate: Math.round(errorRate * 10) / 10,
        perModel,
        latencyTrend,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Metrics failed"
    logger.error("Failed to load metrics", { error: message })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
