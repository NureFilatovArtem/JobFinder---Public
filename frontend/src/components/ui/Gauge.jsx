import { useMemo } from "react"
import { cn } from "@/lib/utils"

export const Gauge = ({ value, size = "medium", showValue = true }) => {
    const sizes = {
        small: { width: 40, stroke: 4, text: "text-xs" },
        medium: { width: 64, stroke: 10, text: "text-[18px] font-medium" },
        large: { width: 96, stroke: 12, text: "text-xl" }
    }

    const { width, stroke, text } = sizes[size] || sizes.medium
    const radius = 45
    const circumference = 2 * Math.PI * radius
    const normalizedValue = Math.min(100, Math.max(0, value))
    const offset = circumference - (normalizedValue / 100) * circumference

    // Dynamic Color Logic: Red (<20), Orange (20-39), Green (40+)
    const colorClass = normalizedValue > 75
        ? "text-emerald-500 dark:text-emerald-400"
        : normalizedValue >= 45
            ? "text-orange-500 dark:text-orange-400"
            : "text-gray-400 dark:text-gray-500"

    return (
        <div className="relative flex items-center justify-center" style={{ width, height: width }}>
            <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth={stroke} fill="transparent" className="text-gray-200 dark:text-gray-700" />
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={stroke}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={cn("transition-all duration-1000 ease-out", colorClass)}
                />
            </svg>
            {showValue && (
                <span className={cn("absolute font-bold", text, colorClass)}>
                    {value}%
                </span>
            )}
        </div>
    )
}
