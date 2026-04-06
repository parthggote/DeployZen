"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Badge } from "@/components/ui/badge"

const SAMPLE_DATA = [
  { time: "00:00", latency: 120, requests: 45 },
  { time: "04:00", latency: 115, requests: 52 },
  { time: "08:00", latency: 108, requests: 68 },
  { time: "12:00", latency: 95, requests: 85 },
  { time: "16:00", latency: 102, requests: 92 },
  { time: "20:00", latency: 108, requests: 78 },
]

/**
 * Inner recharts component — code-split away from main bundle
 */
export default function StatsChartInner() {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5">
          Sample data
        </Badge>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={SAMPLE_DATA}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="time" className="text-xs fill-muted-foreground" />
            <YAxis className="text-xs fill-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--surface))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Line type="monotone" dataKey="latency" stroke="hsl(var(--warning))" strokeWidth={2} name="Latency (ms)" dot={false} />
            <Line type="monotone" dataKey="requests" stroke="hsl(var(--success))" strokeWidth={2} name="Requests/min" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
