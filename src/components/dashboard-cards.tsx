"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ImageIcon,
  BoxIcon,
  FileTextIcon,
  LayersIcon,
  ActivityIcon,
} from "lucide-react";

export function DashboardCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Project Image Column */}
      <Card className="flex flex-col">
        <CardHeader className="flex-none flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Project Image</CardTitle>
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg p-4">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4 text-center">
              No project image uploaded
            </p>
            <Button variant="outline" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" />
              Upload Image
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Emissions Column */}
      <Card className="bg-orange-500 flex flex-col">
        <CardHeader className="flex-none flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white">
            Total Emissions
          </CardTitle>
          <ActivityIcon className="h-4 w-4 text-white" />
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <p className="text-lg text-white">Loading emissions data...</p>
        </CardContent>
      </Card>

      {/* Metrics Column */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Elements
            </CardTitle>
            <BoxIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">3</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uploads</CardTitle>
            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">13</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materials</CardTitle>
            <LayersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
