"use client"

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts"

interface LiveChartProps {
  data: number[]
  color: string
  label: string
  showGrid?: boolean
}

export function LiveChart({ data, color, label, showGrid = false }: LiveChartProps) {
  const chartData = data.map((value, index) => ({
    index,
    value,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        {showGrid && (
          <defs>
            <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.1} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        <YAxis hide />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          fill={showGrid ? "url(#grid)" : "none"}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
