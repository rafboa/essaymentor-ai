"use client";

import { useTheme } from "next-themes";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts";

interface ScoreRadarChartProps {
  scores: {
    structure: number;
    tone: number;
    relevance: number;
    originality: number;
    impact: number;
  };
}

export function ScoreRadarChart({ scores }: ScoreRadarChartProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  
  const data = [
    { subject: "Structure", A: scores.structure, fullMark: 100 },
    { subject: "Tone", A: scores.tone, fullMark: 100 },
    { subject: "Relevance", A: scores.relevance, fullMark: 100 },
    { subject: "Originality", A: scores.originality, fullMark: 100 },
    { subject: "Impact", A: scores.impact, fullMark: 100 },
  ];

  const strokeColor = isDark ? "#818cf8" : "#4f46e5";
  const fillColor = isDark ? "rgba(99, 102, 241, 0.45)" : "rgba(79, 70, 229, 0.25)";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)";
  const textColor = isDark ? "#cbd5e1" : "#334155";

  return (
    <div className="w-full h-[250px] mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: textColor, fontSize: 12, fontWeight: 500 }} 
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={{ fill: "transparent" }}
            axisLine={false} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff", 
              borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
              color: theme === "dark" ? "#f8fafc" : "#0f172a",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
            }}
            itemStyle={{ color: strokeColor, fontWeight: "bold" }}
          />
          <Radar
            name="Score"
            dataKey="A"
            stroke={strokeColor}
            fill={fillColor}
            fillOpacity={0.6}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
