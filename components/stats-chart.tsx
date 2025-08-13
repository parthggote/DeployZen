"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const data = [
  { time: "00:00", latency: 120, requests: 45, tokens: 1200 },
  { time: "04:00", latency: 115, requests: 52, tokens: 1350 },
  { time: "08:00", latency: 108, requests: 68, tokens: 1800 },
  { time: "12:00", latency: 95, requests: 85, tokens: 2200 },
  { time: "16:00", latency: 102, requests: 92, tokens: 2400 },
  { time: "20:00", latency: 108, requests: 78, tokens: 2100 },
]

export function StatsChart() {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
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
          <Line type="monotone" dataKey="latency" stroke="hsl(var(--warning))" strokeWidth={2} name="Latency (ms)" />
          <Line type="monotone" dataKey="requests" stroke="hsl(var(--success))" strokeWidth={2} name="Requests/min" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
