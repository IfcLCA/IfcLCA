"use client"

import * as React from "react"
import { useMemo, useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon } from "@radix-ui/react-icons"
import { ReloadIcon } from "@radix-ui/react-icons"
import { Slider } from "@/components/ui/slider"

interface MaterialChange {
  materialId: string
  materialName: string
  oldMatch: {
    Name: string
    Density: number
    Elements: any[]
  } | null
  newMatch: {
    Name: string
    Density: number
    Elements: any[]
    hasDensityRange: boolean
    minDensity?: number
    maxDensity?: number
  }
  projects: string[]
  projectId?: string
  elements: any[]
  selectedDensity?: number
}

interface MaterialChangesPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (changesWithDensity: MaterialChange[]) => void
  onNavigateToProject?: (projectId: string) => void
  changes: MaterialChange[]
  isLoading?: boolean
}

export function MaterialChangesPreviewModal({
  changes,
  isOpen,
  onClose,
  onConfirm,
  onNavigateToProject,
  isLoading = false
}: MaterialChangesPreviewModalProps) {
  const [localChanges, setLocalChanges] = React.useState<MaterialChange[]>(changes);

  React.useEffect(() => {
    setLocalChanges(changes.map(change => ({
      ...change,
      selectedDensity: change.newMatch.Density
    })));
  }, [changes]);

  const handleDensityChange = (materialId: string, newValue: number[]) => {
    setLocalChanges(prev => prev.map(change => 
      change.materialId === materialId 
        ? { ...change, selectedDensity: newValue[0] }
        : change
    ));
  };

  const handleConfirm = () => {
    onConfirm(localChanges);
  };

  // Check if all materials are from the same project
  const singleProjectId = useMemo(() => {
    if (!changes.length) return null;
    
    // Get all unique project IDs
    const uniqueProjectIds = new Set<string>();
    changes.forEach(change => {
      if (change.projectId) {
        uniqueProjectIds.add(change.projectId);
      }
    });

    // Return the project ID if there's exactly one, otherwise null
    return uniqueProjectIds.size === 1 ? Array.from(uniqueProjectIds)[0] : null;
  }, [changes]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Material Changes</DialogTitle>
          <DialogDescription>
            Review the changes that will be applied to your materials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>KBOB Match</TableHead>
                <TableHead>Density (kg/m³)</TableHead>
                <TableHead>Affected Elements</TableHead>
                <TableHead>Projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localChanges.map((change) => (
                <TableRow key={change.materialId}>
                  <TableCell>{change.materialName}</TableCell>
                  <TableCell>
                    {change.oldMatch && (
                      <div className="line-through text-muted-foreground">
                        {change.oldMatch.Name}
                      </div>
                    )}
                    <div className="text-green-600">{change.newMatch.Name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {change.oldMatch && (
                        <div className="line-through text-muted-foreground">
                          {change.oldMatch.Density.toFixed(0)} kg/m³
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-green-600">{change.selectedDensity?.toFixed(0) || change.newMatch.Density.toFixed(0)} kg/m³</span>
                      </div>
                      {change.newMatch.hasDensityRange && change.newMatch.minDensity !== undefined && change.newMatch.maxDensity !== undefined && (
                        <>
                          <Slider
                            value={[change.selectedDensity || change.newMatch.Density]}
                            min={change.newMatch.minDensity}
                            max={change.newMatch.maxDensity}
                            step={1}
                            onValueChange={(value) => handleDensityChange(change.materialId, value)}
                            className="w-[120px]"
                          />
                          <div className="text-xs text-muted-foreground">
                            Range: {change.newMatch.minDensity.toFixed(0)} - {change.newMatch.maxDensity.toFixed(0)} kg/m³
                          </div>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{change.elements?.length || 0}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate">
                      {change.projects.join(', ')}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {isLoading ? (
            <Button disabled>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Applying Changes...
            </Button>
          ) : singleProjectId && onNavigateToProject ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 pr-3">
                  <span>Confirm Changes</span>
                  <div className="h-4 w-[1px] bg-white/20" />
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleConfirm}>
                  Return to Library
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  await handleConfirm();
                  onNavigateToProject(singleProjectId);
                }}>
                  Go to Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleConfirm}>Confirm Changes</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
