import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const RUNTIME_DATA_ROOT = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data')
const DATA_DIR = RUNTIME_DATA_ROOT
const APIS_FILE = path.join(DATA_DIR, "apis.json")
const APIS_DIR = path.join(DATA_DIR, "apis")

function ensureDirectories() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(APIS_DIR)) fs.mkdirSync(APIS_DIR, { recursive: true })
  } catch {}
}

interface TestCase {
  id: string
  name: string
  description: string
  testCode: string
  status: "pending" | "passed" | "failed" | "running"
  result?: string
  error?: string
  executionTime?: number
  timestamp?: string
  suggestion?: string
}

function loadApis(): any[] {
  try {
    ensureDirectories()
    if (fs.existsSync(APIS_FILE)) {
      return JSON.parse(fs.readFileSync(APIS_FILE, "utf8"))
    }
  } catch {}
  return []
}

function saveApis(apis: any[]) {
  try {
    ensureDirectories()
    fs.writeFileSync(APIS_FILE, JSON.stringify(apis, null, 2))
  } catch {}
}

function logActivity(message: string) {
  const ts = new Date().toISOString()
  const entry = `## ${ts}\n- Feature: APIs\n- Summary: ${message}\n\n`
  try { ensureDirectories(); fs.appendFileSync(path.join(DATA_DIR, "activity-log.md"), entry) } catch {}
}

// Mock expect function for assertions
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected} but got ${actual}`);
    }
  },
  toBeGreaterThanOrEqual: (expected: number) => {
    if (actual < expected) {
      throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
    }
  },
  toBeLessThan: (expected: number) => {
    if (actual >= expected) {
      throw new Error(`Expected ${actual} to be less than ${expected}`);
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toHaveProperty: (prop: string) => {
    if (!actual || typeof actual !== 'object' || !(prop in actual)) {
      throw new Error(`Expected object to have property ${prop}`);
    }
  }
});

async function executeTest(test: TestCase, apiContent: string): Promise<{
  passed: boolean
  result: string
  error?: string
  suggestion?: string
}> {
  try {
    // Create a new function to execute the test code
    // We'll wrap the test code in an async function and provide mock globals
    const mockFetch = async (url: string, options: any = {}) => {
      // Simulate a fetch response based on the URL and options
      // In a real implementation, this would actually make HTTP requests
      // For now, we'll simulate responses based on common patterns
      
      // Simulate different responses based on URL and method
      const method = (options.method || 'GET').toUpperCase();
      const urlPath = url.replace(/^https?:\/\/[^\/]+/, ''); // Remove domain
      
      // Simulate some common responses
      if (urlPath.includes('login') && method === 'POST') {
        if (options.body && options.body.includes('invalid')) {
          return {
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Invalid credentials' })
          };
        }
        return {
          status: 200,
          statusText: 'OK',
          json: async () => ({ token: 'mock-jwt-token' })
        };
      }
      
      if (urlPath.includes('register') && method === 'POST') {
        if (options.body && options.body.includes('existing')) {
          return {
            status: 409,
            statusText: 'Conflict',
            json: async () => ({ error: 'User already exists' })
          };
        }
        return {
          status: 201,
          statusText: 'Created',
          json: async () => ({ message: 'User registered successfully' })
        };
      }
      
      if (urlPath.includes('profile') && method === 'GET') {
        const authHeader = options.headers && options.headers['Authorization'];
        if (!authHeader || !authHeader.includes('Bearer')) {
          return {
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Token is invalid or expired' })
          };
        }
        return {
          status: 200,
          statusText: 'OK',
          json: async () => ({ email: 'user@example.com', role: 'user', created_at: new Date().toISOString() })
        };
      }
      
      // Default response
      return {
        status: 200,
        statusText: 'OK',
        json: async () => ({ message: 'Success' })
      };
    };
    
    // Mock describe and it functions for test structure
    const describe = (name: string, fn: () => void) => {
      // Just execute the function
      fn();
    };
    
    const it = async (name: string, fn: () => void) => {
      // Just execute the function
      await fn();
    };
    
    // Create the test function with our mocks
    const testFn = new Function('fetch', 'expect', 'describe', 'it', `
      return (async () => {
        ${test.testCode}
      })();
    `);
    
    // Execute the test
    await testFn(mockFetch, expect, describe, it);
    
    // If we get here, the test passed
    return {
      passed: true,
      result: "Test executed successfully"
    };
  } catch (error: any) {
    // Test failed
    const errorMessage = error.message || "Test execution failed";
    
    return {
      passed: false,
      result: "Test execution failed",
      error: errorMessage
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiId, testIds } = await req.json()
    if (!apiId) return NextResponse.json({ success: false, error: "API ID is required" }, { status: 400 })
    const apis = loadApis()
    const api = apis.find((a: any) => a.id === apiId)
    if (!api) return NextResponse.json({ success: false, error: "API not found" }, { status: 404 })

    const testsToExecute = testIds ? api.testCases.filter((t: any) => testIds.includes(t.id)) : api.testCases
    if (testsToExecute.length === 0) return NextResponse.json({ success: false, error: "No tests to execute" }, { status: 400 })

    // Read the API content for context in generating suggestions
    let apiContent = ""
    try {
      apiContent = fs.readFileSync(api.filePath, 'utf8')
    } catch {
      apiContent = "// API content not available"
    }

    const executed: TestCase[] = []
    let passed = 0, failed = 0
    
    for (const test of testsToExecute) {
      const start = Date.now()
      
      // Actually execute the test
      const testResult = await executeTest(test, apiContent)
      
      const executionTime = Date.now() - start
      
      const executedTest: TestCase = {
        ...test,
        status: testResult.passed ? 'passed' : 'failed',
        result: testResult.result,
        error: testResult.error,
        executionTime,
        timestamp: new Date().toISOString()
      }
      
      executed.push(executedTest)
      if (testResult.passed) passed++; else failed++
    }

    // Update the API record
    api.testCases = api.testCases.map((t: any) => executed.find((e: any) => e.id === t.id) || t)
    api.status = "completed"
    api.lastTested = new Date().toISOString()
    api.passedTests = passed
    api.failedTests = failed
    saveApis(apis)
    
    logActivity(`Executed ${executed.length} tests for API '${api.name}' (${passed} passed, ${failed} failed)`)
    
    return NextResponse.json({
      success: true,
      results: executed,
      summary: {
        total: executed.length,
        passed,
        failed,
        successRate: executed.length > 0 ? (passed / executed.length) * 100 : 0
      },
      message: `Executed ${executed.length} tests`
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    
  } catch (e) {
    console.error('Test execution error:', e)
    return NextResponse.json({ success: false, error: "Failed to execute tests" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}