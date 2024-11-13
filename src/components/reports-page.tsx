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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Mock data - replace with actual data from your backend
const projects = [
  { id: 1, name: "Project A" },
  { id: 2, name: "Project B" },
  { id: 3, name: "Project C" },
];

const elements = ["Walls", "Floors", "Roofs", "Windows", "Doors"];
const materials = ["Concrete", "Steel", "Wood", "Glass", "Insulation"];
const indicators = [
  "Global Warming Potential",
  "Ozone Depletion",
  "Acidification",
  "Eutrophication",
  "Energy Use",
];

export default function ReportsPage() {
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [detailLevel, setDetailLevel] = useState("medium");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  const handleProjectChange = (projectId: number) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleElementChange = (element: string) => {
    setSelectedElements((prev) =>
      prev.includes(element)
        ? prev.filter((e) => e !== element)
        : [...prev, element]
    );
  };

  const handleMaterialChange = (material: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(material)
        ? prev.filter((m) => m !== material)
        : [...prev, material]
    );
  };

  const handleIndicatorChange = (indicator: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(indicator)
        ? prev.filter((i) => i !== indicator)
        : [...prev, indicator]
    );
  };

  const generateReport = () => {
    // This is where you would typically make an API call to generate the report
    // For this example, we'll just create a simple string representation
    const report = `
      Generated Report:
      Projects: ${selectedProjects
        .map((id) => projects.find((p) => p.id === id)?.name)
        .join(", ")}
      Detail Level: ${detailLevel}
      Elements: ${selectedElements.join(", ")}
      Materials: ${selectedMaterials.join(", ")}
      Indicators: ${selectedIndicators.join(", ")}
    `;
    setGeneratedReport(report);
  };

  return (
    <div className="main-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-description">
            Generate and manage project reports
          </p>
        </div>
        <Button>Generate New Report</Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Settings</CardTitle>
            <CardDescription>Configure your report parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generateReport();
              }}
              className="space-y-6"
            >
              <div>
                <Label className="text-base">Select Projects</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`project-${project.id}`}
                        checked={selectedProjects.includes(project.id)}
                        onCheckedChange={() => handleProjectChange(project.id)}
                      />
                      <Label htmlFor={`project-${project.id}`}>
                        {project.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="detail-level" className="text-base">
                  Detail Level
                </Label>
                <RadioGroup
                  id="detail-level"
                  value={detailLevel}
                  onValueChange={setDetailLevel}
                  className="flex space-x-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="detail-low" />
                    <Label htmlFor="detail-low">Low</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="detail-medium" />
                    <Label htmlFor="detail-medium">Medium</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="detail-high" />
                    <Label htmlFor="detail-high">High</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label className="text-base">Select Elements</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {elements.map((element) => (
                    <div key={element} className="flex items-center space-x-2">
                      <Checkbox
                        id={`element-${element}`}
                        checked={selectedElements.includes(element)}
                        onCheckedChange={() => handleElementChange(element)}
                      />
                      <Label htmlFor={`element-${element}`}>{element}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-base">Select Materials</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {materials.map((material) => (
                    <div key={material} className="flex items-center space-x-2">
                      <Checkbox
                        id={`material-${material}`}
                        checked={selectedMaterials.includes(material)}
                        onCheckedChange={() => handleMaterialChange(material)}
                      />
                      <Label htmlFor={`material-${material}`}>{material}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-base">Select Indicators</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {indicators.map((indicator) => (
                    <div
                      key={indicator}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`indicator-${indicator}`}
                        checked={selectedIndicators.includes(indicator)}
                        onCheckedChange={() => handleIndicatorChange(indicator)}
                      />
                      <Label htmlFor={`indicator-${indicator}`}>
                        {indicator}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit">Generate Report</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Generated Report</CardTitle>
            <CardDescription>
              Your customized report will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generatedReport ? (
              <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md">
                {generatedReport}
              </pre>
            ) : (
              <p className="text-muted-foreground">
                No report generated yet. Use the form to create a report.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
