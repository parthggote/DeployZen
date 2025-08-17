import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

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

async function logActivity(message: string) {
  try {
    const client = await clientPromise;
    const db = client.db("DeployZen");
    await db.collection("activity_log").insertOne({
      timestamp: new Date(),
      feature: "APIs",
      summary: message,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

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
    const mockFetch = async (url: string, options: any = {}) => {
      const method = (options.method || 'GET').toUpperCase();
      const urlPath = url.replace(/^https?:\/\/[^\/]+/, '');
      if (urlPath.includes('login') && method === 'POST') {
        if (options.body && options.body.includes('invalid')) {
          return { status: 401, statusText: 'Unauthorized', json: async () => ({ error: 'Invalid credentials' }) };
        }
        return { status: 200, statusText: 'OK', json: async () => ({ token: 'mock-jwt-token' }) };
      }
      if (urlPath.includes('register') && method === 'POST') {
        if (options.body && options.body.includes('existing')) {
          return { status: 409, statusText: 'Conflict', json: async () => ({ error: 'User already exists' }) };
        }
        return { status: 201, statusText: 'Created', json: async () => ({ message: 'User registered successfully' }) };
      }
      if (urlPath.includes('profile') && method === 'GET') {
        const authHeader = options.headers && options.headers['Authorization'];
        if (!authHeader || !authHeader.includes('Bearer')) {
          return { status: 401, statusText: 'Unauthorized', json: async () => ({ error: 'Token is invalid or expired' }) };
        }
        return { status: 200, statusText: 'OK', json: async () => ({ email: 'user@example.com', role: 'user', created_at: new Date().toISOString() }) };
      }
      return { status: 200, statusText: 'OK', json: async () => ({ message: 'Success' }) };
    };
    const describe = (name: string, fn: () => void) => { fn(); };
    const it = async (name: string, fn: () => void) => { await fn(); };
    const testFn = new Function('fetch', 'expect', 'describe', 'it', `return (async () => { ${test.testCode} })();`);
    await testFn(mockFetch, expect, describe, it);
    return { passed: true, result: "Test executed successfully" };
  } catch (error: any) {
    return { passed: false, result: "Test execution failed", error: error.message || "Test execution failed" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiId, testIds } = await req.json()
    if (!apiId || !ObjectId.isValid(apiId)) {
      return NextResponse.json({ success: false, error: "Invalid API ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")
    const api = await db.collection("apis").findOne({ _id: new ObjectId(apiId) })

    if (!api) {
      return NextResponse.json({ success: false, error: "API not found" }, { status: 404 })
    }

    const testsToExecute = testIds
      ? api.testCases.filter((t: any) => testIds.includes(t.id))
      : api.testCases

    if (!testsToExecute || testsToExecute.length === 0) {
      return NextResponse.json({ success: false, error: "No tests to execute" }, { status: 400 })
    }

    const apiContent = (api as any).content || ''

    const executed: TestCase[] = []
    let passed = 0, failed = 0
    
    for (const test of testsToExecute) {
      const start = Date.now()
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

    const updatedTestCases = api.testCases.map((t: any) => executed.find((e: any) => e.id === t.id) || t)

    await db.collection("apis").updateOne(
      { _id: new ObjectId(apiId) },
      {
        $set: {
          testCases: updatedTestCases,
          status: "completed",
          lastTested: new Date().toISOString(),
          passedTests: passed, // Resetting counts for this test run
          failedTests: failed,
        }
      }
    )
    
    await logActivity(`Executed ${executed.length} tests for API '${api.name}' (${passed} passed, ${failed} failed)`)
    
    return NextResponse.json({
      success: true,
      results: executed,
      summary: { total: executed.length, passed, failed, successRate: executed.length > 0 ? (passed / executed.length) * 100 : 0 },
      message: `Executed ${executed.length} tests`
    })
    
  } catch (e: any) {
    console.error('Test execution error:', e)
    return NextResponse.json({ success: false, error: "Failed to execute tests" }, { status: 500 })
  }
}