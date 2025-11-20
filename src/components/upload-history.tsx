"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Grid,
  List,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Upload {
  id: string;
  filename: string;
  uploadDate: Date;
  status: "Processing" | "Completed" | "Failed";
  elementCount: number;
  fileSize: string;
  version: number;
}

interface UploadFilters {
  dateRange: [Date | undefined, Date | undefined];
  status: ("Processing" | "Completed" | "Failed")[];
}

interface UploadHistoryProps {
  uploads: Upload[];
  currentVersion: number;
  filters: UploadFilters;
}

export function UploadHistory({
  uploads,
  currentVersion,
  filters,
}: UploadHistoryProps) {
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [dateRange, setDateRange] = React.useState<
    [Date | undefined, Date | undefined]
  >(filters.dateRange);
  const [status, setStatus] = React.useState<
    ("Processing" | "Completed" | "Failed")[]
  >(filters.status);

  const filteredUploads = uploads.filter((upload) => {
    const inDateRange =
      dateRange[0] && dateRange[1]
        ? upload.uploadDate >= dateRange[0] && upload.uploadDate <= dateRange[1]
        : true;
    const inStatus = status.length > 0 ? status.includes(upload.status) : true;
    return inDateRange && inStatus;
  });

  const handleCompare = (uploadId: string) => {};

  const handleRestore = (uploadId: string) => {};

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Upload History</h1>
        <div className="flex space-x-2">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setView("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.[0] ? (
                dateRange[1] ? (
                  <>
                    {format(dateRange[0], "LLL dd, y")} -{" "}
                    {format(dateRange[1], "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange[0], "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.[0]}
              selected={dateRange?.[0] && dateRange[1] ? { from: dateRange[0], to: dateRange[1] } : dateRange?.[0] ? { from: dateRange[0] } : undefined}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange([range.from, range.to]);
                } else if (range?.from) {
                  setDateRange([range.from, undefined]);
                } else {
                  setDateRange([undefined, undefined]);
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[180px]">
              Status
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[180px]">
            <DropdownMenuCheckboxItem
              checked={status.includes("Processing")}
              onCheckedChange={(checked) =>
                setStatus(
                  checked
                    ? [...status, "Processing"]
                    : status.filter((s) => s !== "Processing")
                )
              }
            >
              Processing
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={status.includes("Completed")}
              onCheckedChange={(checked) =>
                setStatus(
                  checked
                    ? [...status, "Completed"]
                    : status.filter((s) => s !== "Completed")
                )
              }
            >
              Completed
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={status.includes("Failed")}
              onCheckedChange={(checked) =>
                setStatus(
                  checked
                    ? [...status, "Failed"]
                    : status.filter((s) => s !== "Failed")
                )
              }
            >
              Failed
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Select defaultValue={currentVersion.toString()}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: currentVersion }, (_, i) => (
              <SelectItem key={i} value={(i + 1).toString()}>
                Version {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          "grid gap-4",
          view === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}
      >
        {filteredUploads.map((upload) => (
          <Card key={upload.id}>
            <CardHeader>
              <CardTitle>{upload.filename}</CardTitle>
              <CardDescription>
                Uploaded on {format(upload.uploadDate, "PPP")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <div>Status:</div>
                <div>{upload.status}</div>
                <div>Elements:</div>
                <div>{upload.elementCount}</div>
                <div>File Size:</div>
                <div>{upload.fileSize}</div>
                <div>Version:</div>
                <div>{upload.version}</div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => handleCompare(upload.id)}
              >
                Compare
              </Button>
              <Button onClick={() => handleRestore(upload.id)}>Restore</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
