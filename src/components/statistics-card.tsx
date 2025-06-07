"use client";

import { useEffect, useState } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatisticsCardProps {
    title: string;
    value: number;
    description: string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    format?: (value: number) => string;
    className?: string;
    isLoading?: boolean;
}

export function StatisticsCard({
    title,
    value,
    description,
    icon: Icon,
    trend,
    format,
    className,
    isLoading = false,
}: StatisticsCardProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!isLoading && value !== displayValue) {
            setIsAnimating(true);
            const duration = 1000; // 1 second animation
            const steps = 60;
            const increment = (value - displayValue) / steps;
            let currentStep = 0;

            const timer = setInterval(() => {
                currentStep++;
                if (currentStep >= steps) {
                    setDisplayValue(value);
                    setIsAnimating(false);
                    clearInterval(timer);
                } else {
                    setDisplayValue((prev) => prev + increment);
                }
            }, duration / steps);

            return () => clearInterval(timer);
        }
    }, [value, displayValue, isLoading]);

    const formatValue = (val: number) => {
        if (format) return format(val);

        if (val >= 1000000) {
            return `${(val / 1000000).toFixed(1)}M`;
        }
        if (val >= 1000) {
            return `${(val / 1000).toFixed(1)}k`;
        }
        return Math.floor(val).toLocaleString();
    };

    if (isLoading) {
        return (
            <Card className={className}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-32 mb-1" />
                    <Skeleton className="h-3 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            className={cn(
                "group relative overflow-hidden transition-all hover:shadow-md",
                "hover:border-primary/20",
                className
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="relative">
                    <Icon className="h-4 w-4 text-muted-foreground transition-all group-hover:text-primary group-hover:scale-110" />
                    <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </CardHeader>

            <CardContent>
                <div className="flex items-baseline gap-2">
                    <div
                        className={cn(
                            "text-2xl font-bold transition-all",
                            "group-hover:text-primary",
                            isAnimating && "text-primary"
                        )}
                    >
                        {formatValue(displayValue)}
                    </div>

                    {trend && (
                        <span
                            className={cn(
                                "text-xs font-medium",
                                trend.isPositive ? "text-green-600" : "text-red-600"
                            )}
                        >
                            {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
                        </span>
                    )}
                </div>


            </CardContent>
        </Card>
    );
}

export function StatisticsCardSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-32 mb-1" />
            </CardContent>
        </Card>
    );
} 