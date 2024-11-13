"use client";

import { useState } from "react";
import { X, Maximize2, Minimize2, Terminal } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { IFCParseResult } from "@/lib/types/ifc";

interface UploadConsoleProps {
  results: IFCParseResult | null;
  onClose: () => void;
}

export function UploadConsole({ results, onClose }: UploadConsoleProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!results) return null;

  return (
    <Card
      className={`
      fixed bottom-4 right-4 
      ${isMinimized ? "w-64 h-12" : "w-96 h-96"} 
      bg-background border shadow-lg 
      transition-all duration-200 ease-in-out
      z-50
    `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <span className="text-sm font-medium">Upload Results</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content - only shown when not minimized */}
      {!isMinimized && (
        <ScrollArea className="h-[calc(100%-2.5rem)] p-4">
          <div className="space-y-4">
            {/* Element Types */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Elements by Type</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(results.summary.elementsByType).map(
                  ([type, count]) => (
                    <Badge key={type} variant="secondary">
                      {type.replace("IFC", "")}: {count}
                    </Badge>
                  )
                )}
              </div>
            </div>

            {/* Materials */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Materials Found ({results.summary.foundMaterials.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {results.summary.foundMaterials.map((material) => (
                  <Badge key={material} variant="outline">
                    {material}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Elements Without Materials */}
            {results.summary.elementsWithoutMaterials.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 text-yellow-600">
                  Elements Without Materials (
                  {results.summary.elementsWithoutMaterials.length})
                </h3>
                <div className="space-y-1">
                  {results.summary.elementsWithoutMaterials.map((element) => (
                    <div
                      key={element.id}
                      className="text-sm flex justify-between"
                    >
                      <span>{element.name}</span>
                      <span className="text-muted-foreground">
                        {element.type.replace("IFC", "")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
