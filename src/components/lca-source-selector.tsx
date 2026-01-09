"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LcaDataSource, LcaDataSourceInfo } from "@/lib/types/lca";

interface LcaSourceSelectorProps {
  value: LcaDataSource;
  onChange: (source: LcaDataSource) => void;
  className?: string;
  showIndicators?: boolean;
  disabled?: boolean;
}

export function LcaSourceSelector({
  value,
  onChange,
  className,
  showIndicators = true,
  disabled = false,
}: LcaSourceSelectorProps) {
  const [sources, setSources] = useState<LcaDataSourceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSources() {
      try {
        const response = await fetch("/api/lca-materials/sources");
        if (response.ok) {
          const data = await response.json();
          setSources(data.sources);
        }
      } catch (error) {
        console.error("Failed to fetch LCA sources:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSources();
  }, []);

  const selectedSource = sources.find((s) => s.id === value);

  const getIndicatorBadges = useCallback((indicators: string[]) => {
    return indicators.map((indicator) => {
      const label = indicator.toUpperCase();
      const colors: Record<string, string> = {
        gwp: "bg-emerald-100 text-emerald-700 border-emerald-200",
        ubp: "bg-blue-100 text-blue-700 border-blue-200",
        penre: "bg-orange-100 text-orange-700 border-orange-200",
      };
      return (
        <Badge
          key={indicator}
          variant="outline"
          className={`text-[10px] px-1 py-0 ${colors[indicator] || ""}`}
        >
          {label}
        </Badge>
      );
    });
  }, []);

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading sources..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <TooltipProvider>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue>
            {selectedSource && (
              <div className="flex items-center gap-2">
                <span>{selectedSource.countryFlag}</span>
                <span>{selectedSource.name}</span>
                {!selectedSource.isConfigured && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    Not configured
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sources.map((source) => (
            <Tooltip key={source.id}>
              <TooltipTrigger asChild>
                <SelectItem
                  value={source.id}
                  disabled={!source.isConfigured}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{source.countryFlag}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{source.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {source.country}
                        </span>
                      </div>
                    </div>
                    {showIndicators && (
                      <div className="flex items-center gap-1">
                        {getIndicatorBadges(source.indicators)}
                      </div>
                    )}
                    {!source.isConfigured && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1 py-0 ml-2"
                      >
                        API key required
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">{source.description}</p>
                {source.docsUrl && (
                  <a
                    href={source.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1 block"
                  >
                    Documentation
                  </a>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </SelectContent>
      </Select>
    </TooltipProvider>
  );
}

export function LcaSourceBadge({
  source,
  className,
}: {
  source: LcaDataSource;
  className?: string;
}) {
  const sourceInfo: Record<LcaDataSource, { flag: string; name: string }> = {
    kbob: { flag: "🇨🇭", name: "KBOB" },
    okobaudat: { flag: "🇩🇪", name: "ÖKOBAUDAT" },
    openepd: { flag: "🌍", name: "OpenEPD" },
  };

  const info = sourceInfo[source];

  return (
    <Badge variant="outline" className={className}>
      <span className="mr-1">{info.flag}</span>
      {info.name}
    </Badge>
  );
}
