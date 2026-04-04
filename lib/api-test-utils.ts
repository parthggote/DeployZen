export type TestStatus = "pending" | "passed" | "failed" | "running"
export type TestCategory = "happy-path" | "validation" | "auth" | "security" | "edge-case"
export type TestPriority = "high" | "medium" | "low"

export interface RouteDefinition {
  method: string
  path: string
  requiresAuth: boolean
  source: "openapi" | "code" | "heuristic"
  responseFields?: string[]
}

export interface StructuredTestCase {
  id: string
  name: string
  description: string
  testCode: string
  status: TestStatus
  result?: string
  error?: string
  executionTime?: number
  timestamp?: string
  suggestion?: string
  category: TestCategory
  priority: TestPriority
  method: string
  path: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: Record<string, unknown> | null
  expectedStatus: number
  expectedBodyShape?: string[]
  tags?: string[]
  assumptions?: string[]
}

function normalizePath(input: string) {
  if (!input) return "/"
  const value = input.trim()
  if (value === "/") return "/"
  return value.replace(/\/+$/, "") || "/"
}

function createTestId(prefix: string, index: number) {
  return `${prefix}_${Date.now()}_${index + 1}`
}

function looksProtected(text: string) {
  return /\b(auth|authorization|bearer|jwt|token|protect|middleware|session)\b/i.test(text)
}

function dedupeRoutes(routes: RouteDefinition[]) {
  const seen = new Set<string>()
  return routes.filter((route) => {
    const key = `${route.method}:${route.path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseOpenApiJson(content: string): RouteDefinition[] {
  try {
    const parsed = JSON.parse(content)
    if (!parsed || (typeof parsed !== "object")) return []
    if (!parsed.openapi && !parsed.swagger) return []
    const paths = parsed.paths || {}
    const globalRequiresAuth = Boolean(parsed.security && Array.isArray(parsed.security) && parsed.security.length > 0)

    return Object.entries(paths).flatMap(([path, methods]) => {
      if (!methods || typeof methods !== "object") return []
      return Object.entries(methods as Record<string, any>)
        .filter(([method]) => ["get", "post", "put", "patch", "delete"].includes(method.toLowerCase()))
        .map(([method, operation]) => {
          const responseSchema =
            operation?.responses?.["200"]?.content?.["application/json"]?.schema?.properties ||
            operation?.responses?.["201"]?.content?.["application/json"]?.schema?.properties
          const responseFields = responseSchema ? Object.keys(responseSchema) : []
          return {
            method: method.toUpperCase(),
            path: normalizePath(path),
            requiresAuth: globalRequiresAuth || Boolean(operation?.security?.length),
            source: "openapi" as const,
            responseFields,
          }
        })
    })
  } catch {
    return []
  }
}

function parseCodeRoutes(content: string): RouteDefinition[] {
  const routes: RouteDefinition[] = []
  const pushRoute = (method: string, path: string, snippet: string) => {
    routes.push({
      method: method.toUpperCase(),
      path: normalizePath(path),
      requiresAuth: looksProtected(snippet),
      source: "code",
    })
  }

  const expressRegex = /(app|router)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]\s*,?([\s\S]{0,240})/gi
  let expressMatch: RegExpExecArray | null
  while ((expressMatch = expressRegex.exec(content)) !== null) {
    pushRoute(expressMatch[2], expressMatch[3], expressMatch[4] || "")
  }

  const fastApiRegex = /@(app|router)\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']([\s\S]{0,160})/gi
  let fastApiMatch: RegExpExecArray | null
  while ((fastApiMatch = fastApiRegex.exec(content)) !== null) {
    pushRoute(fastApiMatch[2], fastApiMatch[3], fastApiMatch[4] || "")
  }

  const flaskRegex = /@app\.route\(\s*["']([^"']+)["'](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?/gi
  let flaskMatch: RegExpExecArray | null
  while ((flaskMatch = flaskRegex.exec(content)) !== null) {
    const methods = flaskMatch[2]
      ? flaskMatch[2].split(",").map((item) => item.replace(/["'\s]/g, "")).filter(Boolean)
      : ["GET"]
    methods.forEach((method) => pushRoute(method, flaskMatch![1], flaskMatch![0]))
  }

  return routes
}

export function extractRoutesFromApiContent(content: string): RouteDefinition[] {
  const openApiRoutes = parseOpenApiJson(content)
  if (openApiRoutes.length > 0) {
    return dedupeRoutes(openApiRoutes)
  }

  const codeRoutes = parseCodeRoutes(content)
  if (codeRoutes.length > 0) {
    return dedupeRoutes(codeRoutes)
  }

  return [{
    method: "GET",
    path: "/",
    requiresAuth: looksProtected(content),
    source: "heuristic",
  }]
}

function deriveSampleBody(route: RouteDefinition) {
  if (!["POST", "PUT", "PATCH"].includes(route.method)) return null
  return route.requiresAuth
    ? { sample: "value", token: "replace-me" }
    : { sample: "value" }
}

export function buildTestCodePreview(test: StructuredTestCase) {
  const headers = test.headers && Object.keys(test.headers).length > 0 ? JSON.stringify(test.headers, null, 2) : "{}"
  const body =
    test.body && Object.keys(test.body).length > 0
      ? `,\n      body: JSON.stringify(${JSON.stringify(test.body, null, 2)})`
      : ""

  return `describe("${test.name}", () => {
  it("${test.description}", async () => {
    const response = await fetch("${test.path}", {
      method: "${test.method}",
      headers: ${headers}${body}
    })

    expect(response.status).toBe(${test.expectedStatus})
  })
})`
}

function createStructuredCase(base: Omit<StructuredTestCase, "id" | "testCode" | "status" | "timestamp">, index: number) {
  const test: StructuredTestCase = {
    ...base,
    id: createTestId("structured_test", index),
    testCode: "",
    status: "pending",
    timestamp: new Date().toISOString(),
  }
  test.testCode = buildTestCodePreview(test)
  return test
}

export function generateDeterministicTestCases(apiContent: string, apiName: string, description: string) {
  const routes = extractRoutesFromApiContent(apiContent)
  const testCases: StructuredTestCase[] = []
  const globalAuth = looksProtected(apiContent)

  routes.slice(0, 4).forEach((route) => {
    testCases.push(createStructuredCase({
      name: `${route.method} ${route.path} returns a success response`,
      description: `Validates the primary ${route.method} ${route.path} flow discovered in ${apiName}.`,
      category: "happy-path",
      priority: "high",
      method: route.method,
      path: route.path,
      headers: route.requiresAuth ? { Authorization: "Bearer <token>" } : {},
      body: deriveSampleBody(route),
      expectedStatus: route.method === "POST" ? 201 : 200,
      expectedBodyShape: route.responseFields || [],
      tags: [route.source, "primary-flow"],
      assumptions: description ? [description] : [],
    }, testCases.length))

    if (route.requiresAuth || globalAuth) {
      testCases.push(createStructuredCase({
        name: `${route.method} ${route.path} rejects missing authentication`,
        description: `Checks that protected access to ${route.path} is not available without credentials.`,
        category: "auth",
        priority: "high",
        method: route.method,
        path: route.path,
        headers: {},
        body: deriveSampleBody(route),
        expectedStatus: 401,
        expectedBodyShape: ["error"],
        tags: [route.source, "auth"],
        assumptions: ["Authentication appears to be required from the uploaded source."],
      }, testCases.length))
    }

    if (["POST", "PUT", "PATCH"].includes(route.method)) {
      testCases.push(createStructuredCase({
        name: `${route.method} ${route.path} validates malformed payloads`,
        description: `Sends an invalid request body to confirm validation rules are enforced.`,
        category: "validation",
        priority: "medium",
        method: route.method,
        path: route.path,
        headers: route.requiresAuth ? { Authorization: "Bearer <token>" } : {},
        body: { invalid: null },
        expectedStatus: 400,
        expectedBodyShape: ["error"],
        tags: [route.source, "validation"],
        assumptions: ["The route performs request-body validation before processing."],
      }, testCases.length))
    }

    if (/[:{].+[}\w]/.test(route.path)) {
      testCases.push(createStructuredCase({
        name: `${route.method} ${route.path} handles missing or invalid path parameters`,
        description: `Covers the edge case where dynamic route parameters are absent, malformed, or unresolved.`,
        category: "edge-case",
        priority: "medium",
        method: route.method,
        path: route.path,
        headers: route.requiresAuth ? { Authorization: "Bearer <token>" } : {},
        body: deriveSampleBody(route),
        expectedStatus: 404,
        expectedBodyShape: ["error"],
        tags: [route.source, "edge"],
        assumptions: ["Dynamic route parameters should be validated or rejected cleanly."],
      }, testCases.length))
    }

    if (["GET", "POST"].includes(route.method)) {
      testCases.push(createStructuredCase({
        name: `${route.method} ${route.path} defends against hostile input`,
        description: `Exercises likely security-sensitive inputs such as script tags, SQL fragments, or unexpected query values.`,
        category: "security",
        priority: "medium",
        method: route.method,
        path: route.path,
        headers: route.requiresAuth ? { Authorization: "Bearer <token>" } : {},
        query: route.method === "GET" ? { q: "' OR 1=1 --" } : undefined,
        body: route.method === "POST" ? { input: "<script>alert(1)</script>" } : null,
        expectedStatus: route.requiresAuth ? 400 : 200,
        expectedBodyShape: route.requiresAuth ? ["error"] : route.responseFields || [],
        tags: [route.source, "security"],
        assumptions: ["Security handling may vary; this test is intended to expose sanitization or rejection behavior."],
      }, testCases.length))
    }
  })

  return testCases.slice(0, 10)
}

export function coerceGeneratedTestCase(test: any, index: number): StructuredTestCase {
  const coerced: StructuredTestCase = {
    id: test.id || createTestId("ai_test", index),
    name: test.name || `Generated Test ${index + 1}`,
    description: test.description || "AI-generated structured test case",
    testCode: "",
    status: "pending",
    timestamp: new Date().toISOString(),
    category: test.category || "happy-path",
    priority: test.priority || "medium",
    method: String(test.method || "GET").toUpperCase(),
    path: normalizePath(String(test.path || "/")),
    headers: typeof test.headers === "object" && test.headers ? test.headers : {},
    query: typeof test.query === "object" && test.query ? test.query : undefined,
    body: typeof test.body === "object" ? test.body : null,
    expectedStatus: Number(test.expectedStatus) || 200,
    expectedBodyShape: Array.isArray(test.expectedBodyShape) ? test.expectedBodyShape : [],
    tags: Array.isArray(test.tags) ? test.tags : [],
    assumptions: Array.isArray(test.assumptions) ? test.assumptions : [],
  }
  coerced.testCode = buildTestCodePreview(coerced)
  return coerced
}

function segmentToRegex(segment: string) {
  if (/^\{.+\}$/.test(segment) || /^:.+/.test(segment)) return "[^/]+"
  return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function matchRoute(candidatePath: string, routePath: string) {
  const candidate = normalizePath(candidatePath)
  const route = normalizePath(routePath)
  if (candidate === route) return true
  const regex = new RegExp(`^${route.split("/").map(segmentToRegex).join("/")}$`)
  return regex.test(candidate)
}

export function validateStructuredTest(test: StructuredTestCase, apiContent: string) {
  const routes = extractRoutesFromApiContent(apiContent)
  const route = routes.find((item) => item.method === test.method && matchRoute(test.path, item.path))

  if (!route) {
    return {
      passed: false,
      result: "Static contract validation failed",
      error: `No ${test.method} route matching ${test.path} was inferred from the uploaded source.`,
      suggestion: "Review the uploaded file, adjust the route path, or regenerate tests after providing a clearer API description.",
    }
  }

  if (test.category === "auth" && !(route.requiresAuth || looksProtected(apiContent))) {
    return {
      passed: false,
      result: "Static contract validation failed",
      error: `The generated auth test expects protected access for ${route.path}, but authentication signals were not found in the uploaded source.`,
      suggestion: "Mark the route as protected in the source or regenerate tests with auth requirements described explicitly.",
    }
  }

  const notes = [
    `Matched inferred route: ${route.method} ${route.path}`,
    `Execution mode: static contract validation`,
    `Expected status: ${test.expectedStatus}`,
  ]

  if (route.requiresAuth) {
    notes.push("Authentication indicators were detected for this route.")
  }
  if (test.expectedBodyShape && test.expectedBodyShape.length > 0) {
    notes.push(`Expected response fields: ${test.expectedBodyShape.join(", ")}`)
  }

  return {
    passed: true,
    result: notes.join("\n"),
  }
}
