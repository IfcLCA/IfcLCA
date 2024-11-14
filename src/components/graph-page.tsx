"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  LineChart,
} from "recharts";

interface MaterialData {
  id: string;
  name: string;
  category?: string;
  volume: number;
  gwp: number;
  ubp: number;
  penre: number;
}

export function GraphPageComponent({
  materialsData,
}: {
  materialsData: MaterialData[];
}) {
  const [selectedIndicator, setSelectedIndicator] = useState<string>("gwp");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [chartData, setChartData] = useState<any[]>([]);

  // Memoize the unique materials to prevent unnecessary recalculations
  const uniqueMaterials = useMemo(() => {
    if (!materialsData?.length) return new Map<string, MaterialData>();

    const materials = new Map<string, MaterialData>();
    materialsData.forEach((material) => {
      if (!materials.has(material.name)) {
        materials.set(material.name, material);
      } else {
        const existing = materials.get(material.name)!;
        materials.set(material.name, {
          ...material,
          volume: (existing.volume || 0) + (material.volume || 0),
          gwp: (existing.gwp || 0) + (material.gwp || 0),
          ubp: (existing.ubp || 0) + (material.ubp || 0),
          penre: (existing.penre || 0) + (material.penre || 0),
        });
      }
    });
    return materials;
  }, [materialsData]);

  // Update selected materials when data changes
  useEffect(() => {
    if (uniqueMaterials.size > 0) {
      setSelectedMaterials(Array.from(uniqueMaterials.keys()));
    }
  }, [uniqueMaterials]);

  // Memoize chart data to prevent unnecessary updates
  useEffect(() => {
    const newChartData = Array.from(uniqueMaterials.values())
      .filter((material) => selectedMaterials.includes(material.name))
      .map((material) => ({
        name: material.name,
        value: material[selectedIndicator as keyof typeof material] || 0,
        volume: material.volume || 0,
      }))
      .sort((a, b) => b.value - a.value);

    setChartData(newChartData);
  }, [uniqueMaterials, selectedIndicator, selectedMaterials]);

  if (!materialsData?.length) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">No materials data available.</p>
      </div>
    );
  }

  const handleMaterialToggle = (materialId: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((m) => m !== materialId)
        : [...prev, materialId]
    );
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}k`;
    }
    return value.toFixed(2);
  };

  const getIndicatorUnit = (indicator: string) => {
    switch (indicator) {
      case 'gwp':
        return 'kg CO₂ eq';
      case 'ubp':
        return 'UBP';
      case 'penre':
        return 'MJ';
      default:
        return '';
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Environmental Indicator</CardTitle>
            <CardDescription>Choose an indicator to visualize</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedIndicator}
              onValueChange={setSelectedIndicator}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an indicator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gwp">Global Warming Potential (GWP)</SelectItem>
                <SelectItem value="ubp">Environmental Impact Points (UBP)</SelectItem>
                <SelectItem value="penre">Non-renewable Primary Energy (PENRE)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Materials</CardTitle>
            <CardDescription>Select materials to include</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[300px] overflow-y-auto">
            {Array.from(uniqueMaterials.values()).map((material) => (
              <div
                key={material.name}
                className="flex items-center space-x-2 mb-2"
              >
                <Checkbox
                  id={`material-${material.name}`}
                  checked={selectedMaterials.includes(material.name)}
                  onCheckedChange={() => handleMaterialToggle(material.name)}
                />
                <Label htmlFor={`material-${material.name}`} className="flex-1">
                  {material.name}
                  {material.volume > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({material.volume.toFixed(2)} m³)
                    </span>
                  )}
                  {material.category && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {material.category}
                    </span>
                  )}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Environmental Impact Visualization</CardTitle>
            <Tabs
              value={chartType}
              onValueChange={(value) => setChartType(value as "bar" | "line")}
            >
              <TabsList>
                <TabsTrigger value="bar">Bar Chart</TabsTrigger>
                <TabsTrigger value="line">Line Chart</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription>
            Comparing {selectedIndicator.toUpperCase()} ({getIndicatorUnit(selectedIndicator)}) across materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={formatValue}
                    label={{ value: getIndicatorUnit(selectedIndicator), angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <p className="font-semibold">{data.name}</p>
                            <p>{`${selectedIndicator.toUpperCase()}: ${formatValue(data.value)} ${getIndicatorUnit(selectedIndicator)}`}</p>
                            <p>{`Volume: ${data.volume.toFixed(2)} m³`}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={formatValue}
                    label={{ value: getIndicatorUnit(selectedIndicator), angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <p className="font-semibold">{data.name}</p>
                            <p>{`${selectedIndicator.toUpperCase()}: ${formatValue(data.value)} ${getIndicatorUnit(selectedIndicator)}`}</p>
                            <p>{`Volume: ${data.volume.toFixed(2)} m³`}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
