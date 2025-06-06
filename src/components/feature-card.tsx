"use client";

import { useState } from "react";
import Link from "next/link";
import { LucideIcon, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  link?: string;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  link = "/documentation",
}: FeatureCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="relative h-56 cursor-pointer"
      onClick={() => setFlipped(!flipped)}
      onMouseLeave={() => setFlipped(false)}
      style={{ perspective: "1000px" }}
    >
      <div
        className={cn(
          "absolute inset-0 transition-transform duration-700 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]"
        )}
      >
        <Card className="h-full backface-hidden flex flex-col items-center justify-center shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardHeader className="items-center">
            <Icon className="h-10 w-10 text-orange-600 dark:text-orange-400 mb-2" />
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 dark:text-gray-300">{description}</p>
          </CardContent>
        </Card>
        <Card className="h-full backface-hidden [transform:rotateY(180deg)] flex flex-col items-center justify-center shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardContent className="text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>
            <Link href={link} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
