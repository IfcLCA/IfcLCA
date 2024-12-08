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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  PieChart,
  Pie,
  Cell,
  LabelList,
  ScatterChart,
  Scatter,
  ComposedChart,
  ZAxis,
} from "recharts";
import { PrinterIcon } from "lucide-react";

interface MaterialData {
  name: string;
  volume: number;
  indicators?: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  kbobMaterial?: string;
  ifcMaterial?: string;
  category?: string;
}

type GroupingMode = "elements" | "kbobMaterials" | "ifcMaterials";

interface Props {
  materialsData?: MaterialData[];
}

export function GraphPageComponent({ materialsData }: Props) {
  const [selectedIndicator, setSelectedIndicator] = useState<string>("gwp");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie" | "bubble">(
    "bar"
  );
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("elements");
  const [chartData, setChartData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [colorTheme, setColorTheme] = useState<ColorTheme>("standard");

  // Memoize the unique materials to prevent unnecessary recalculations
  const uniqueMaterials = useMemo(() => {
    if (!materialsData?.length) return new Map<string, MaterialData>();

    const materials = new Map<string, MaterialData>();
    materialsData.forEach((material) => {
      // Determine the key based on grouping mode
      const key =
        groupingMode === "kbobMaterials"
          ? material.kbobMaterial || "Unknown KBOB Material"
          : groupingMode === "ifcMaterials"
          ? material.ifcMaterial || "Unknown Ifc Material"
          : material.name;

      const existingMaterial = materials.get(key);

      if (!existingMaterial) {
        materials.set(key, {
          name: key,
          volume: material.volume || 0,
          indicators: {
            gwp: material.indicators?.gwp || 0,
            ubp: material.indicators?.ubp || 0,
            penre: material.indicators?.penre || 0,
          },
          category: material.category,
          kbobMaterial: material.kbobMaterial,
          ifcMaterial: material.ifcMaterial,
        });
      } else {
        // Aggregate volumes and indicators
        materials.set(key, {
          ...existingMaterial,
          volume: (existingMaterial.volume || 0) + (material.volume || 0),
          indicators: {
            gwp:
              (existingMaterial.indicators?.gwp || 0) +
              (material.indicators?.gwp || 0),
            ubp:
              (existingMaterial.indicators?.ubp || 0) +
              (material.indicators?.ubp || 0),
            penre:
              (existingMaterial.indicators?.penre || 0) +
              (material.indicators?.penre || 0),
          },
        });
      }
    });
    return materials;
  }, [materialsData, groupingMode]);

  // Update selected materials when data changes
  useEffect(() => {
    if (uniqueMaterials.size > 0) {
      setSelectedMaterials(Array.from(uniqueMaterials.keys()));
    }
  }, [uniqueMaterials]);

  // Update chart data when selected materials or indicator changes
  useEffect(() => {
    if (!materialsData?.length) return;

    const filteredData = Array.from(uniqueMaterials.values())
      .filter((material) => selectedMaterials.includes(material.name))
      .map((material) => ({
        name: material.name,
        volume: material.volume || 0,
        gwp: material.indicators?.gwp || 0,
        ubp: material.indicators?.ubp || 0,
        penre: material.indicators?.penre || 0,
        category: material.category,
        kbobMaterial: material.kbobMaterial,
        ifcMaterial: material.ifcMaterial,
      }))
      .sort((a, b) => b[selectedIndicator] - a[selectedIndicator]);

    setChartData(filteredData);
  }, [uniqueMaterials, selectedMaterials, selectedIndicator]);

  const formatValue = (
    value: number | null | undefined,
    selectedIndicator: string
  ) => {
    if (value === null || value === undefined) return "0";

    // Convert PENRE from MJ to kWh if needed
    if (selectedIndicator === "penre") {
      value = value / 3.6; // Convert MJ to kWh (1 kWh = 3.6 MJ)
    }

    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return value.toFixed(1);
  };

  const getIndicatorUnit = (indicator: string) => {
    switch (indicator) {
      case "gwp":
        return "kg CO₂ eq";
      case "ubp":
        return "UBP";
      case "penre":
        return "kWh";
      default:
        return "";
    }
  };

  const handleMaterialToggle = (materialId: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((m) => m !== materialId)
        : [...prev, materialId]
    );
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const chartContainer = document.querySelector(".recharts-wrapper");
    if (!chartContainer) return;

    const chartSvg = chartContainer.querySelector("svg")?.outerHTML;
    if (!chartSvg) return;

    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    printWindow.document.write(`
      <html>
        <head>
          <title>IfcLCA - ${date}</title>
          <style>
            @page {
              size: A4;
              margin: 2cm;
            }
            body {
              font-family: system-ui, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 20px;
              border-bottom: 1px solid #eee;
            }
            .logo-container {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo {
              height: 40px;
            }
            .tool-name {
              font-size: 24px;
              font-weight: 600;
              color: #333;
            }
            .metadata {
              margin-bottom: 20px;
              font-size: 0.9em;
              color: #666;
            }
            .project-info {
              margin: 20px 0;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 6px;
            }
            .chart-container {
              margin: 20px 0;
              max-width: 100%;
              height: auto;
            }
            .chart-container svg {
              width: 100% !important;
              height: auto !important;
              max-height: 400px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 0.9em;
            }
            th, td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f5f5f5;
              font-weight: 600;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            @media print {
              button { display: none; }
              .chart-container svg {
                max-height: none !important;
              }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="margin-bottom: 20px; padding: 8px 16px;">Print</button>
          
          <div class="header">
            <div class="logo-container">
              <img src="/logo.png" alt="Logo" class="logo" />
              <span class="tool-name">IfcLCA</span>
            </div>
            <div style="text-align: right">
              <div>Generated: ${date} ${time}</div>
            </div>
          </div>

          <div class="metadata">
            <div><strong>Indicator:</strong> ${selectedIndicator.toUpperCase()} (${getIndicatorUnit(
      selectedIndicator
    )})</div>
            <div><strong>Chart Type:</strong> ${
              chartType.charAt(0).toUpperCase() + chartType.slice(1)
            } Chart</div>
            <div><strong>Materials Selected:</strong> ${
              selectedMaterials.length
            }</div>
            <div><strong>Total Volume:</strong> ${chartData
              .reduce((sum, item) => sum + item.volume, 0)
              .toFixed(2)} m³</div>
          </div>

          <div class="chart-container">
            ${chartSvg}
          </div>

          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th style="text-align: right">Volume (m³)</th>
                <th style="text-align: right">${selectedIndicator.toUpperCase()} (${getIndicatorUnit(
      selectedIndicator
    )})</th>
              </tr>
            </thead>
            <tbody>
              ${chartData
                .sort((a, b) => b[selectedIndicator] - a[selectedIndicator])
                .map(
                  (item) => `
                  <tr>
                    <td>${item.name}</td>
                    <td style="text-align: right">${item.volume.toFixed(2)}</td>
                    <td style="text-align: right">${formatValue(
                      item[selectedIndicator],
                      selectedIndicator
                    )}</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>

          <div style="margin-top: 20px; font-size: 0.8em; color: #666; text-align: center;">
            Generated with IfcLCA
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 60, bottom: 120 },
    };

    const commonTooltip = {
      content: ({ active, payload }: any) => {
        if (active && payload && payload.length) {
          const data = payload[0].payload;
          return (
            <div className="rounded-lg border bg-background p-2 shadow-md">
              <p className="font-semibold">{data.name}</p>
              <p>{`${selectedIndicator.toUpperCase()}: ${formatValue(
                data[selectedIndicator],
                selectedIndicator
              )} ${getIndicatorUnit(selectedIndicator)}`}</p>
              <p>{`Volume: ${data.volume.toFixed(2)} m³`}</p>
            </div>
          );
        }
        return null;
      },
    };

    // Get color based on theme and index
    const getColor = (index: number, value?: number) => {
      switch (colorTheme) {
        case "standard":
          return "hsl(var(--primary))"; // Orange theme color
        case "bw":
          return "#000000";
        case "colorful":
          // Get the value for gradient calculation
          let gradientValue: number;
          if (value !== undefined) {
            gradientValue = value;
          } else if (chartData[index]) {
            gradientValue = chartData[index][selectedIndicator] || 0;
          } else {
            return "#ff7f0e"; // Fallback to orange if no value available
          }

          // Calculate gradient color based on emission value
          const minValue = Math.min(
            ...chartData.map((item) => item[selectedIndicator] || 0)
          );
          const maxValue = Math.max(
            ...chartData.map((item) => item[selectedIndicator] || 0)
          );
          const normalizedValue =
            (gradientValue - minValue) / (maxValue - minValue);

          // Interpolate from red (high emissions) to more muted green (low emissions)
          const red = Math.round(255 * normalizedValue);
          const green = Math.round(120 + 30 * (1 - normalizedValue));
          const blue = Math.round(90 * (1 - normalizedValue));
          return `rgb(${red}, ${green}, ${blue})`;
      }
    };

    switch (chartType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              height={120}
              interval={0}
              tick={{
                angle: -45,
                textAnchor: "end",
                fontSize: 12,
                fill: "hsl(var(--foreground))",
              }}
            />
            <YAxis
              tickFormatter={(value) => formatValue(value, selectedIndicator)}
              width={60}
              tick={{
                fontSize: 12,
                fill: "hsl(var(--foreground))",
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={false}
              axisLine={false}
              label={{
                value: getIndicatorUnit(selectedIndicator),
                angle: -90,
                position: "insideRight",
                fill: "hsl(var(--foreground))",
              }}
            />
            <Tooltip {...commonTooltip} />
            <Bar
              dataKey={selectedIndicator}
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(index, entry[selectedIndicator])}
                />
              ))}
            </Bar>
          </BarChart>
        );

      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{
                fill: "hsl(var(--foreground))",
              }}
            />
            <YAxis
              tickFormatter={(value) => formatValue(value, selectedIndicator)}
              tick={{
                fill: "hsl(var(--foreground))",
              }}
              label={{
                value: `${selectedIndicator.toUpperCase()} (${getIndicatorUnit(
                  selectedIndicator
                )})`,
                angle: -90,
                position: "left",
                fill: "hsl(var(--foreground))",
                offset: 5,
              }}
            />
            <Tooltip {...commonTooltip} />
            <Line
              type="monotone"
              dataKey={selectedIndicator}
              stroke={
                colorTheme === "bw"
                  ? "#000000"
                  : getColor(0, chartData[0] && chartData[0][selectedIndicator])
              }
              dot={{
                fill:
                  colorTheme === "bw"
                    ? "#000000"
                    : getColor(
                        0,
                        chartData[0] && chartData[0][selectedIndicator]
                      ),
              }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        );

      case "pie":
        return (
          <PieChart {...commonProps}>
            <Pie
              data={chartData}
              dataKey={selectedIndicator}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={150}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(1)}%)`
              }
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(index, entry[selectedIndicator])}
                />
              ))}
            </Pie>
            <Tooltip {...commonTooltip} />
          </PieChart>
        );

      case "bubble":
        // Transform data for bubble chart
        const bubbleData = chartData.map((item) => ({
          name: item.name,
          x: item.volume || 0, // X-axis is always volume
          y: item[selectedIndicator] || 0, // Y-axis is the selected indicator
          z: item.volume || 0, // Z-axis (bubble size) is volume
          label: `${item.name}\n${formatValue(
            item[selectedIndicator] || 0,
            selectedIndicator
          )}`,
        }));

        // Calculate domain for bubble sizing
        const volumeDomain = [
          Math.min(...bubbleData.map((item) => item.z)),
          Math.max(...bubbleData.map((item) => item.z)),
        ];
        const sizeRange = [400, 4000]; // Min and max bubble sizes in pixels

        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              name="Volume"
              tickFormatter={(value) => `${value.toFixed(1)}`}
              tick={{
                fill: "hsl(var(--foreground))",
              }}
              label={{
                value: "Volume (m³)",
                position: "bottom",
                fill: "hsl(var(--foreground))",
                offset: 5,
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name={selectedIndicator}
              tickFormatter={(value) => formatValue(value, selectedIndicator)}
              tick={{
                fill: "hsl(var(--foreground))",
              }}
              label={{
                value: `${selectedIndicator.toUpperCase()} (${getIndicatorUnit(
                  selectedIndicator
                )})`,
                angle: -90,
                position: "left",
                fill: "hsl(var(--foreground))",
                offset: 5,
              }}
            />
            <ZAxis
              dataKey="z"
              type="number"
              range={sizeRange}
              domain={volumeDomain}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md">
                      <p className="font-semibold">{data.name}</p>
                      <p>{`Volume: ${data.z.toFixed(2)} m³`}</p>
                      <p>{`${selectedIndicator.toUpperCase()}: ${formatValue(
                        data.y,
                        selectedIndicator
                      )} ${getIndicatorUnit(selectedIndicator)}`}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="Materials" data={bubbleData} fillOpacity={0.7}>
              {bubbleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(index, entry.y)} />
              ))}
              {window.matchMedia("print").matches && (
                <LabelList
                  dataKey="label"
                  position="center"
                  fill="#000000"
                  style={{ fontSize: "12px", fontWeight: "bold" }}
                />
              )}
            </Scatter>
          </ScatterChart>
        );
      default:
        return null;
    }
  };

  if (!materialsData?.length) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">No materials data available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Chart Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <Label className="mb-2 block">Materials</Label>
                <Select
                  value={JSON.stringify(selectedMaterials)}
                  onValueChange={(value) => {
                    const materials = JSON.parse(value);
                    setSelectedMaterials(
                      Array.isArray(materials) ? materials : [materials]
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select materials">
                      {selectedMaterials.length} material
                      {selectedMaterials.length !== 1 ? "s" : ""} selected
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <div className="mb-2">
                        <input
                          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Search materials..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 max-h-[200px] overflow-auto">
                        <div
                          className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            const allMaterials = Array.from(
                              uniqueMaterials.keys()
                            );
                            setSelectedMaterials(
                              selectedMaterials.length === allMaterials.length
                                ? []
                                : allMaterials
                            );
                          }}
                        >
                          <Checkbox
                            checked={
                              selectedMaterials.length ===
                              Array.from(uniqueMaterials.keys()).length
                            }
                            className="mr-2"
                          />
                          <span>Select All</span>
                        </div>
                        {Array.from(uniqueMaterials.entries())
                          .sort((a, b) => b[1].volume - a[1].volume)
                          .filter(([name]) =>
                            name
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase())
                          )
                          .map(([name, material]) => (
                            <div
                              key={name}
                              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                              onClick={() => handleMaterialToggle(name)}
                            >
                              <Checkbox
                                checked={selectedMaterials.includes(name)}
                                className="mr-2"
                              />
                              <span className="flex-1 truncate">{name}</span>
                              {material.volume > 0 && (
                                <span className="ml-2 text-muted-foreground">
                                  ({material.volume.toFixed(2)} m³)
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="mb-2 block">Environmental Indicator</Label>
                <Select
                  value={selectedIndicator}
                  onValueChange={setSelectedIndicator}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select indicator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gwp">
                      Global Warming Potential
                    </SelectItem>
                    <SelectItem value="odp">
                      Ozone Depletion Potential
                    </SelectItem>
                    <SelectItem value="ap">Acidification Potential</SelectItem>
                    <SelectItem value="ep">Eutrophication Potential</SelectItem>
                    <SelectItem value="pocp">
                      Photochemical Ozone Creation Potential
                    </SelectItem>
                    <SelectItem value="penrt">
                      Total Non-Renewable Primary Energy
                    </SelectItem>
                    <SelectItem value="pert">
                      Total Renewable Primary Energy
                    </SelectItem>
                    <SelectItem value="ubp">
                      Environmental Impact Points
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="mb-2 block">Chart Type</Label>
                <Tabs
                  defaultValue="bar"
                  value={chartType}
                  onValueChange={(value) => setChartType(value as any)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="bar">Bar</TabsTrigger>
                    <TabsTrigger value="line">Line</TabsTrigger>
                    <TabsTrigger value="pie">Pie</TabsTrigger>
                    <TabsTrigger value="bubble">Bubble</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1">
                <Label className="mb-2 block">Grouping Mode</Label>
                <Select
                  value={groupingMode}
                  onValueChange={(value) => setGroupingMode(value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grouping mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elements">Group by Elements</SelectItem>
                    <SelectItem value="kbobMaterials">
                      Group by KBOB Materials
                    </SelectItem>
                    <SelectItem value="ifcMaterials">
                      Group by Ifc Materials
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Environmental Impact Visualization</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-md border bg-muted p-1">
                <Button
                  variant={colorTheme === "standard" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setColorTheme("standard")}
                  className="px-3"
                >
                  <div className="h-4 w-4 rounded-full bg-primary" />
                </Button>
                <Button
                  variant={colorTheme === "bw" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setColorTheme("bw")}
                  className="px-3"
                >
                  <div className="h-4 w-4 rounded-full bg-black" />
                </Button>
                <Button
                  variant={colorTheme === "colorful" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setColorTheme("colorful")}
                  className="px-3"
                >
                  <div className="flex h-4 w-4">
                    <div className="h-full w-1/3 rounded-l-full bg-[#ff7f0e]" />
                    <div className="h-full w-1/3 bg-[#1f77b4]" />
                    <div className="h-full w-1/3 rounded-r-full bg-[#2ca02c]" />
                  </div>
                </Button>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={handlePrint}
                title="Print Chart"
              >
                <PrinterIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
