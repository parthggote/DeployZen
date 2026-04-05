import logger from "@/lib/logger"

const HF_API_BASE = "https://huggingface.co/api"
const HF_INFERENCE_BASE = "https://router.huggingface.co/hf-inference/models"

export interface HFModelCard {
  id: string
  modelId: string
  pipeline_tag: string | null
  downloads: number
  likes: number
  lastModified: string
  tags: string[]
  library_name?: string
  private: boolean
}

export interface HFModelInfo {
  id: string
  pipeline_tag: string | null
  library_name: string | null
  tags: string[]
  downloads: number
  likes: number
  lastModified: string
  cardData?: Record<string, unknown>
  config?: Record<string, unknown>
  private: boolean
}

export interface HFInferenceResult {
  success: boolean
  output: unknown
  latencyMs: number
  error?: string
  isLoading?: boolean
  estimatedTime?: number
}

/**
 * Searches the HF Hub for models matching a query and optional task filter
 * @param {string} query - Search query string
 * @param {string | null} task - Pipeline tag filter (e.g. "text-generation")
 * @param {string} token - HF access token
 * @returns {Promise<HFModelCard[]>} Array of matching model cards
 */
export async function searchHuggingFaceModels(
  query: string,
  task: string | null,
  token: string
): Promise<HFModelCard[]> {
  const params = new URLSearchParams({
    search: query,
    sort: "downloads",
    direction: "-1",
    limit: "20",
  })

  if (task) {
    params.set("pipeline_tag", task)
  }

  const res = await fetch(`${HF_API_BASE}/models?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    logger.error("HF model search failed", { status: res.status })
    throw new Error(`HF search failed: ${res.status}`)
  }

  const models = await res.json()
  return models.map((m: Record<string, unknown>) => ({
    id: m.id || m.modelId,
    modelId: m.id || m.modelId,
    pipeline_tag: m.pipeline_tag || null,
    downloads: m.downloads || 0,
    likes: m.likes || 0,
    lastModified: m.lastModified || "",
    tags: m.tags || [],
    library_name: m.library_name,
    private: m.private || false,
  }))
}

/**
 * Fetches detailed info for a specific HF model
 * @param {string} modelId - HF model ID (e.g. "mistralai/Mistral-7B-Instruct-v0.3")
 * @param {string} token - HF access token
 * @returns {Promise<HFModelInfo>} Full model metadata
 */
export async function getHuggingFaceModelInfo(
  modelId: string,
  token: string
): Promise<HFModelInfo> {
  const res = await fetch(`${HF_API_BASE}/models/${modelId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Model not found: ${modelId}`)
    }
    throw new Error(`HF model info failed: ${res.status}`)
  }

  return res.json()
}

/**
 * Runs inference on a model via the free HF Serverless Inference API
 * @param {string} modelId - HF model ID
 * @param {unknown} inputs - Model inputs (string for text, object for structured)
 * @param {Record<string, unknown>} parameters - Inference parameters
 * @param {string} token - HF access token
 * @returns {Promise<HFInferenceResult>} Inference result with latency
 */
export async function runHuggingFaceInference(
  modelId: string,
  inputs: unknown,
  parameters: Record<string, unknown>,
  token: string
): Promise<HFInferenceResult> {
  const start = Date.now()

  try {
    const res = await fetch(`${HF_INFERENCE_BASE}/${modelId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs, parameters }),
    })

    const latencyMs = Date.now() - start

    if (res.status === 503) {
      const data = await res.json()
      return {
        success: false,
        output: null,
        latencyMs,
        isLoading: true,
        estimatedTime: data.estimated_time || 30,
        error: "Model is loading, please retry shortly",
      }
    }

    if (res.status === 429) {
      return {
        success: false,
        output: null,
        latencyMs,
        error: "Rate limit exceeded. Please wait a moment and try again.",
      }
    }

    if (!res.ok) {
      const text = await res.text()
      return {
        success: false,
        output: null,
        latencyMs,
        error: `Inference failed: ${res.status} ${text}`,
      }
    }

    const output = await res.json()
    return { success: true, output, latencyMs }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      success: false,
      output: null,
      latencyMs: Date.now() - start,
      error: message,
    }
  }
}

/**
 * Checks whether a model is currently loaded on HF Inference API
 * @param {string} modelId - HF model ID
 * @param {string} token - HF access token
 * @returns {Promise<{loaded: boolean, estimatedTime?: number}>} Status
 */
export async function checkHuggingFaceModelStatus(
  modelId: string,
  token: string
): Promise<{ loaded: boolean; estimatedTime?: number }> {
  try {
    const res = await fetch(`${HF_INFERENCE_BASE}/${modelId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: "test", parameters: { max_new_tokens: 1 } }),
    })

    if (res.status === 503) {
      const data = await res.json()
      return { loaded: false, estimatedTime: data.estimated_time || 30 }
    }

    if (res.ok || res.status === 200) {
      return { loaded: true }
    }

    return { loaded: false }
  } catch {
    return { loaded: false }
  }
}
