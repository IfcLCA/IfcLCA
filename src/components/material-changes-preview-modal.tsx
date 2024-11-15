"use client"

import * as React from "react"
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
  changes: MaterialChange[]
}

export function MaterialChangesPreviewModal({
  changes,
  isOpen,
  onClose,
  onConfirm,
}: MaterialChangesPreviewModalProps) {
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
