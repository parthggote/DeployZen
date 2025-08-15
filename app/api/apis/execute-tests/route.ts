import { NextRequest, NextResponse } from "next/server"
import { handleExecuteTests } from "../[[...rest]]/route"

export async function POST(req: NextRequest) {
  return handleExecuteTests(req)
}