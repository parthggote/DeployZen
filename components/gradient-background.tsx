"use client"

import dynamic from "next/dynamic"

const GrainGradient = dynamic(
  () => import("@paper-design/shaders-react").then((m) => ({ default: m.GrainGradient })),
  { ssr: false }
)

/**
 * WebGL grain gradient background used on the landing page.
 * Dynamically imported to avoid SSR hydration issues with canvas.
 */
export function GradientBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(152, 20%, 6%)"
        softness={0.82}
        intensity={0.32}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={0.85}
        colors={["hsl(152, 45%, 36%)", "hsl(168, 50%, 38%)", "hsl(198, 55%, 42%)"]}
      />
    </div>
  )
}
