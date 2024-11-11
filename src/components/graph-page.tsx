"use client";

import { useState } from "react";
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

// Mock data for demonstration purposes
const projectsData = [
  { id: 1, name: "Project A" },
  { id: 2, name: "Project B" },
  { id: 3, name: "Project C" },
];

const indicatorsData = [
  { id: "gwp", name: "Global Warming Potential" },
  { id: "odp", name: "Ozone Depletion Potential" },
  { id: "ap", name: "Acidification Potential" },
  { id: "ep", name: "Eutrophication Potential" },
];

const materialsData = [
  { id: "concrete", name: "Concrete" },
  { id: "steel", name: "Steel" },
  { id: "wood", name: "Wood" },
  { id: "glass", name: "Glass" },
];

const mockChartData = [
  { name: "Concrete", "Project A": 400, "Project B": 300, "Project C": 200 },
  { name: "Steel", "Project A": 300, "Project B": 400, "Project C": 300 },
  { name: "Wood", "Project A": 200, "Project B": 100, "Project C": 400 },
  { name: "Glass", "Project A": 100, "Project B": 200, "Project C": 100 },
];

export function GraphPageComponent() {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([
    "Project A",
  ]);
  const [selectedIndicator, setSelectedIndicator] = useState<string>("gwp");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([
    "concrete",
    "steel",
    "wood",
    "glass",
  ]);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const handleProjectToggle = (projectName: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectName)
        ? prev.filter((p) => p !== projectName)
        : [...prev, projectName]
    );
  };

  const handleMaterialToggle = (materialId: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((m) => m !== materialId)
        : [...prev, materialId]
    );
  };

  const filteredChartData = mockChartData.filter((item) =>
    selectedMaterials.includes(item.name.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Environmental Impact Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Select projects to compare</CardDescription>
          </CardHeader>
          <CardContent>
            {projectsData.map((project) => (
              <div
                key={project.id}
                className="flex items-center space-x-2 mb-2"
              >
                <Checkbox
                  id={`project-${project.id}`}
                  checked={selectedProjects.includes(project.name)}
                  onCheckedChange={() => handleProjectToggle(project.name)}
                />
                <Label htmlFor={`project-${project.id}`}>{project.name}</Label>
              </div>
            ))}
          </CardContent>
        </Card>

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
                {indicatorsData.map((indicator) => (
                  <SelectItem key={indicator.id} value={indicator.id}>
                    {indicator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Materials</CardTitle>
            <CardDescription>Select materials to include</CardDescription>
          </CardHeader>
          <CardContent>
            {materialsData.map((material) => (
              <div
                key={material.id}
                className="flex items-center space-x-2 mb-2"
              >
                <Checkbox
                  id={`material-${material.id}`}
                  checked={selectedMaterials.includes(material.id)}
                  onCheckedChange={() => handleMaterialToggle(material.id)}
                />
                <Label htmlFor={`material-${material.id}`}>
                  {material.name}
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
            Comparing {selectedIndicator.toUpperCase()} across selected projects
            and materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              "Project A": {
                label: "Project A",
                color: "hsl(var(--chart-1))",
              },
              "Project B": {
                label: "Project B",
                color: "hsl(var(--chart-2))",
              },
              "Project C": {
                label: "Project C",
                color: "hsl(var(--chart-3))",
              },
            }}
            className="h-[400px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  {selectedProjects.map((project, index) => (
                    <Bar
                      key={project}
                      dataKey={project}
                      fill={`var(--color-${project
                        .replace(" ", "-")
                        .toLowerCase()})`}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  {selectedProjects.map((project, index) => (
                    <Line
                      key={project}
                      type="monotone"
                      dataKey={project}
                      stroke={`var(--color-${project
                        .replace(" ", "-")
                        .toLowerCase()})`}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
