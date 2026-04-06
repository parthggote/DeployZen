"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const RechartsChart = dynamic(
  () => import("./stats-chart-inner"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
  }
)

/**
 * Lazy-loaded performance chart — shows sample data with a clear label
 */
export function StatsChart() {
  return <RechartsChart />
}
