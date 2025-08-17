import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function GET(req: NextRequest) {
    const client = await clientPromise
    const db = client.db("DeployZen")
    try {
      const apis = await db.collection("apis").find({}).toArray()
      const apisWithId = apis.map(api => ({ ...api, id: api._id.toString() }))
      return NextResponse.json({ success: true, apis: apisWithId })
    } catch (e) {
      return NextResponse.json({ success: false, error: "Failed to load APIs", apis: [] }, { status: 500 })
    }
}
