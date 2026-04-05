import logger from "@/lib/logger"

const HF_API_BASE = "https://huggingface.co/api"
const HF_ROUTER_BASE = "https://router.huggingface.co"

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
  inferenceProviderMapping?: Record<string, unknown>
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
  inferenceProviderMapping?: Record<string, { provider: string; providerId: string; status: string }>
}

export interface HFInferenceResult {
  success: boolean
  output: unknown
  latencyMs: number
  error?: string
  isLoading?: boolean
  estimatedTime?: number
}

export interface HFInferenceAvailability {
  available: boolean
  provider: string | null
  providerId: string | null
  reason?: string
}

/**
 * Checks which inference providers support a given model via the HF Hub API.
 * Returns the best available provider or indicates the model is unsupported.
 * @param {string} modelId - HF model ID
 * @param {string} token - HF access token
 * @returns {Promise<HFInferenceAvailability>} Availability info
 */
export async function checkInferenceAvailability(
  modelId: string,
  token: string
): Promise<HFInferenceAvailability> {
  try {
    const res = await fetch(`${HF_API_BASE}/models/${modelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      return { available: false, provider: null, providerId: null, reason: `Model not found (${res.status})` }
    }

    const data = await res.json()
    const mapping = data.inferenceProviderMapping as Record<string, { provider: string; providerId: string; status: string }> | undefined

    if (!mapping || Object.keys(mapping).length === 0) {
      return {
        available: false,
        provider: null,
        providerId: null,
        reason: "No inference providers available for this model. Only models with active inference providers on HF can be used.",
      }
    }

    const preferredOrder = ["hf-inference", "together", "fireworks-ai", "replicate", "sambanova", "cerebras"]
    for (const pref of preferredOrder) {
      if (mapping[pref] && mapping[pref].status === "loaded") {
        return { available: true, provider: pref, providerId: mapping[pref].providerId }
      }
    }

    const firstActive = Object.entries(mapping).find(([, v]) => v.status === "loaded")
    if (firstActive) {
      return { available: true, provider: firstActive[0], providerId: firstActive[1].providerId }
    }

    const firstAny = Object.entries(mapping)[0]
    return {
      available: true,
      provider: firstAny[0],
      providerId: firstAny[1].providerId,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { available: false, provider: null, providerId: null, reason: message }
  }
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
    inferenceProviderMapping: m.inferenceProviderMapping || undefined,
  }))
}

/**
 * Fetches detailed info for a specific HF model including inference provider mapping
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
 * Builds the correct inference URL for a given provider and model
 * @param {string} provider - Provider name (e.g. "hf-inference", "together")
 * @param {string} providerId - Provider-specific model ID
 * @param {string} task - Pipeline task type
 * @returns {string} Full inference URL
 */
function buildInferenceUrl(provider: string, providerId: string, task: string): string {
  const chatTasks = ["text-generation", "conversational"]

  if (provider === "hf-inference") {
    return `${HF_ROUTER_BASE}/hf-inference/models/${providerId}`
  }

  if (chatTasks.includes(task)) {
    return `${HF_ROUTER_BASE}/${provider}/v1/chat/completions`
  }

  return `${HF_ROUTER_BASE}/${provider}/models/${providerId}`
}

/**
 * Formats the request body for the appropriate provider format
 * @param {string} provider - Provider name
 * @param {unknown} inputs - Raw user inputs
 * @param {Record<string, unknown>} parameters - Inference parameters
 * @param {string} providerId - Provider model ID
 * @param {string} task - Pipeline task
 * @returns {string} JSON request body
 */
function formatInferenceBody(
  provider: string,
  inputs: unknown,
  parameters: Record<string, unknown>,
  providerId: string,
  task: string
): string {
  const chatTasks = ["text-generation", "conversational"]

  if (provider !== "hf-inference" && chatTasks.includes(task)) {
    return JSON.stringify({
      model: providerId,
      messages: [{ role: "user", content: String(inputs) }],
      max_tokens: parameters.max_new_tokens || 256,
      temperature: parameters.temperature || 0.7,
      top_p: parameters.top_p || 0.9,
    })
  }

  return JSON.stringify({ inputs, parameters })
}

/**
 * Extracts a readable text result from varying provider response formats
 * @param {unknown} data - Raw response JSON
 * @param {string} provider - Provider name
 * @param {string} task - Pipeline task
 * @returns {unknown} Normalized output
 */
function normalizeInferenceOutput(data: unknown, provider: string, task: string): unknown {
  const chatTasks = ["text-generation", "conversational"]

  if (provider !== "hf-inference" && chatTasks.includes(task)) {
    const resp = data as { choices?: Array<{ message?: { content?: string } }> }
    if (resp.choices?.[0]?.message?.content) {
      return [{ generated_text: resp.choices[0].message.content }]
    }
  }

  return data
}

/**
 * Runs inference on a model via the HF Inference Provider routing layer.
 * Automatically selects the best available provider.
 * @param {string} modelId - HF model ID
 * @param {unknown} inputs - Model inputs
 * @param {Record<string, unknown>} parameters - Inference parameters
 * @param {string} token - HF access token
 * @param {string} [provider] - Override provider name
 * @param {string} [providerId] - Override provider model ID
 * @param {string} [task] - Pipeline task (defaults to text-generation)
 * @returns {Promise<HFInferenceResult>} Inference result with latency
 */
export async function runHuggingFaceInference(
  modelId: string,
  inputs: unknown,
  parameters: Record<string, unknown>,
  token: string,
  provider?: string,
  providerId?: string,
  task?: string
): Promise<HFInferenceResult> {
  const start = Date.now()
  const resolvedTask = task || "text-generation"

  try {
    let resolvedProvider = provider
    let resolvedProviderId = providerId

    if (!resolvedProvider || !resolvedProviderId) {
      const availability = await checkInferenceAvailability(modelId, token)
      if (!availability.available) {
        return {
          success: false,
          output: null,
          latencyMs: Date.now() - start,
          error: availability.reason || "No inference provider available for this model",
        }
      }
      resolvedProvider = availability.provider!
      resolvedProviderId = availability.providerId!
    }

    const url = buildInferenceUrl(resolvedProvider, resolvedProviderId, resolvedTask)
    const body = formatInferenceBody(resolvedProvider, inputs, parameters, resolvedProviderId, resolvedTask)

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
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
        error: `Inference failed (${res.status}): ${text}`,
      }
    }

    const rawOutput = await res.json()
    const output = normalizeInferenceOutput(rawOutput, resolvedProvider, resolvedTask)
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
 * Checks whether a model has any inference provider available and if it's loaded.
 * Returns a tri-state: loaded, loading, or unsupported.
 * @param {string} modelId - HF model ID
 * @param {string} token - HF access token
 * @returns {Promise<{loaded: boolean; unsupported: boolean; estimatedTime?: number; reason?: string; provider?: string}>}
 */
export async function checkHuggingFaceModelStatus(
  modelId: string,
  token: string
): Promise<{ loaded: boolean; unsupported: boolean; estimatedTime?: number; reason?: string; provider?: string }> {
  try {
    const availability = await checkInferenceAvailability(modelId, token)

    if (!availability.available) {
      return {
        loaded: false,
        unsupported: true,
        reason: availability.reason || "No inference provider available",
      }
    }

    const url = buildInferenceUrl(availability.provider!, availability.providerId!, "text-generation")
    const chatBody = availability.provider !== "hf-inference"
      ? JSON.stringify({ model: availability.providerId, messages: [{ role: "user", content: "hi" }], max_tokens: 1 })
      : JSON.stringify({ inputs: "test", parameters: { max_new_tokens: 1 } })

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: chatBody,
    })

    if (res.status === 503) {
      const data = await res.json()
      return { loaded: false, unsupported: false, estimatedTime: data.estimated_time || 30, provider: availability.provider! }
    }

    if (res.ok) {
      return { loaded: true, unsupported: false, provider: availability.provider! }
    }

    return { loaded: false, unsupported: false, provider: availability.provider! }
  } catch {
    return { loaded: false, unsupported: false }
  }
}
