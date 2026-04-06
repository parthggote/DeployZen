import logger from "@/lib/logger"

interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of attempts (including the initial request). Defaults to 3. */
  retries?: number
  /** Per-request timeout in milliseconds. Defaults to 30 000 (30 s). */
  timeoutMs?: number
  /** Initial backoff delay in milliseconds. Doubles after each retry. Defaults to 2 000. */
  backoffMs?: number
}

/**
 * Drop-in replacement for `fetch` that adds automatic retries with
 * exponential backoff and per-request timeouts. Designed to handle
 * Render free-tier cold starts where the first request may hang for
 * 30–60 seconds.
 *
 * @param {string} url - The URL to fetch
 * @param {FetchWithRetryOptions} [options] - Standard fetch options plus retry configuration
 * @returns {Promise<Response>} The first successful Response
 * @throws {Error} When all retry attempts are exhausted
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 30_000,
    backoffMs = 2_000,
    ...fetchOptions
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController()
      const existingSignal = fetchOptions.signal

      if (existingSignal?.aborted) {
        throw new DOMException("Request aborted", "AbortError")
      }

      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      const onExternalAbort = () => controller.abort()
      existingSignal?.addEventListener("abort", onExternalAbort, { once: true })

      try {
        const res = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeout)
        existingSignal?.removeEventListener("abort", onExternalAbort)

        if (res.ok || res.status < 500) {
          return res
        }

        lastError = new Error(`Server error: ${res.status} ${res.statusText}`)
      } catch (err) {
        clearTimeout(timeout)
        existingSignal?.removeEventListener("abort", onExternalAbort)

        if (
          existingSignal?.aborted ||
          (err instanceof DOMException && err.name === "AbortError" && !controller.signal.aborted)
        ) {
          throw err
        }

        lastError = err instanceof Error ? err : new Error(String(err))
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err))
    }

    if (attempt < retries - 1) {
      const delay = backoffMs * Math.pow(2, attempt)
      logger.warn("Retrying fetch", {
        url,
        attempt: attempt + 1,
        nextAttemptIn: `${delay}ms`,
        error: lastError?.message,
      })
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error(`Fetch failed after ${retries} attempts: ${url}`)
}
