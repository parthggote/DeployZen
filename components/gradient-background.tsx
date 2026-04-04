"use client"

import { GrainGradient } from "@paper-design/shaders-react"

export function GradientBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(214, 32%, 8%)"
        softness={0.82}
        intensity={0.32}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={0.85}
        colors={["hsl(204, 90%, 60%)", "hsl(188, 69%, 58%)", "hsl(159, 67%, 42%)"]}
      />
    </div>
  )
}
