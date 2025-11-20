"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MagnifyingGlassIcon, ReloadIcon } from "@radix-ui/react-icons";
import { toast } from "@/hooks/use-toast";

interface OkobaudatMaterial {
  uuid: string;
  name: string;
  category: string;
  density?: number;
  gwp: number;
  penre: number;
  ubp?: number;
  declaredUnit: string;
  compliance: string[];
}

interface OkobaudatSearchProps {
  onSelect: (material: OkobaudatMaterial) => void;
  selectedMaterialIds?: string[];
  className?: string;
}

export function OkobaudatSearch({ 
  onSelect, 
  selectedMaterialIds = [],
  className 
}: OkobaudatSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [materials, setMaterials] = useState<OkobaudatMaterial[]>([]);
  const [compliance, setCompliance] = useState<'A1' | 'A2'>('A2');
  const [useFuzzy, setUseFuzzy] = useState(true);
  
  const searchMaterials = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a material name to search",
        variant: "destructive",
      });
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await fetch("/api/okobaudat/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          limit: 50,
          compliance,
          fuzzy: useFuzzy,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Search failed");
      }
      
      const data = await response.json();
      setMaterials(data.materials || []);
      
      if (data.fallback) {
        toast({
          title: "Using sample data",
          description: data.message || "Ökobaudat API not configured. Contact admin to enable live data.",
          variant: "default",
        });
      } else if (data.materials.length === 0) {
        toast({
          title: "No materials found",
          description: "Try different search terms or disable fuzzy matching",
        });
      } else {
        toast({
          title: "Search complete",
          description: `Found ${data.materials.length} materials`,
        });
      }
    } catch (error) {
      console.error("Ökobaudat search error:", error);
      toast({
        title: "Search failed",
        description: "Failed to search Ökobaudat database",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      searchMaterials();
    }
  };
  
  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Search Controls */}
        <div className="flex gap-2">
          <Input
            placeholder="Search Ökobaudat materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          
          <Select value={compliance} onValueChange={(v) => setCompliance(v as 'A1' | 'A2')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A2">EN 15804+A2</SelectItem>
              <SelectItem value="A1">EN 15804+A1</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={searchMaterials}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? (
              <ReloadIcon className="h-4 w-4 animate-spin" />
            ) : (
              <MagnifyingGlassIcon className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useFuzzy}
              onChange={(e) => setUseFuzzy(e.target.checked)}
              className="rounded"
            />
            Use fuzzy matching
          </label>
          
          <span className="text-muted-foreground">
            {materials.length > 0 && `${materials.length} results`}
          </span>
        </div>
        
        {/* Results */}
        {materials.length > 0 && (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {materials.map((material) => (
              <Card
                key={material.uuid}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onSelect(material)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{material.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {material.category}
                      </p>
                      
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          GWP: {material.gwp.toFixed(3)} kg CO₂-eq/{material.declaredUnit}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          PENRE: {material.penre.toFixed(3)} MJ/{material.declaredUnit}
                        </Badge>
                        {material.density && (
                          <Badge variant="outline" className="text-xs">
                            ρ: {material.density} kg/m³
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {selectedMaterialIds.includes(material.uuid) && (
                      <Badge className="ml-2">Selected</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
