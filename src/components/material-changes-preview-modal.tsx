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

interface MaterialChange {
  materialId: string
  materialName: string
  oldKbobMatch?: string
  newKbobMatch: string
  oldDensity?: number
  newDensity: number
  affectedElements: number
  projects: string[]
}

interface MaterialChangesPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onNavigateToProject?: (projectId: string) => void
  changes: MaterialChange[]
}

export function MaterialChangesPreviewModal({
  changes,
  isOpen,
  onClose,
  onConfirm,
  onNavigateToProject,
}: MaterialChangesPreviewModalProps) {
  // Check if all materials are from the same project
  const singleProjectId = useMemo(() => {
    if (!changes.length) return null;
    
    // Get all unique project IDs
    const uniqueProjects = new Set<string>();
    changes.forEach(change => {
      if (change.projects && change.projects.length > 0) {
        change.projects.forEach(project => uniqueProjects.add(project));
      }
    });

    // Log for debugging
    console.log('Changes:', changes);
    console.log('Unique projects:', Array.from(uniqueProjects));

    // Return the project ID if there's exactly one, otherwise null
    return uniqueProjects.size === 1 ? Array.from(uniqueProjects)[0] : null;
  }, [changes]);

  // Log for debugging
  console.log('Single project ID:', singleProjectId);

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
                    {change.oldKbobMatch && (
                      <div className="line-through text-muted-foreground">
                        {change.oldKbobMatch}
                      </div>
                    )}
                    <div className="text-green-600">{change.newKbobMatch}</div>
                  </TableCell>
                  <TableCell>
                    {change.oldDensity && (
                      <div className="line-through text-muted-foreground">
                        {change.oldDensity}
                      </div>
                    )}
                    <div className="text-green-600">{change.newDensity}</div>
                  </TableCell>
                  <TableCell>{change.affectedElements}</TableCell>
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
          {singleProjectId && onNavigateToProject ? (
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
