"use client"

import * as React from "react"
import { useMemo } from "react"
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
  }
  projects: string[]
  projectId?: string
  elements: any[]
}

interface MaterialChangesPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
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
              {changes.map((change) => (
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
                    {change.oldMatch && (
                      <div className="line-through text-muted-foreground">
                        {change.oldMatch.Density}
                      </div>
                    )}
                    <div className="text-green-600">{change.newMatch.Density}</div>
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
                <DropdownMenuItem onClick={onConfirm}>
                  Return to Library
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  await onConfirm();
                  onNavigateToProject(singleProjectId);
                }}>
                  Go to Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={onConfirm}>Confirm Changes</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
