"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface BuildingElement {
  id: string
  name: string
  type: string
  currentMaterial?: string
}

interface Material {
  id: string
  name: string
  category: string
  co2Impact: number
}

interface MaterialAssignmentProps {
  element: BuildingElement
  suggestions: Material[]
  customMaterials: Material[]
  onAssign: (elementId: string, materialId: string) => void
  onCreateCustomMaterial: (material: Omit<Material, "id">) => void
}

export function MaterialAssignmentModal({
  element = { id: '', name: '', type: '' },
  suggestions = [],
  customMaterials = [],
  onAssign,
  onCreateCustomMaterial,
}: MaterialAssignmentProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedMaterials, setSelectedMaterials] = React.useState<string[]>([])
  const [showCustomMaterialDialog, setShowCustomMaterialDialog] = React.useState(false)
  const [newCustomMaterial, setNewCustomMaterial] = React.useState<Omit<Material, "id">>({
    name: "",
    category: "",
    co2Impact: 0,
  })

  const allMaterials = [
    ...(Array.isArray(suggestions) ? suggestions : []),
    ...(Array.isArray(customMaterials) ? customMaterials : [])
  ]

  const filteredMaterials = allMaterials.filter((material) =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectMaterial = (materialId: string) => {
    if (selectedMaterials.includes(materialId)) {
      setSelectedMaterials(selectedMaterials.filter((id) => id !== materialId))
    } else {
      setSelectedMaterials([...selectedMaterials, materialId])
    }
  }

  const handleAssign = () => {
    selectedMaterials.forEach((materialId) => {
      onAssign(element?.id || '', materialId)
    })
    setOpen(false)
  }

  const handleCreateCustomMaterial = () => {
    onCreateCustomMaterial(newCustomMaterial)
    setShowCustomMaterialDialog(false)
    setNewCustomMaterial({ name: "", category: "", co2Impact: 0 })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Assign Material</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Assign Material to {element?.name || 'Element'}</DialogTitle>
          <DialogDescription>
            Search and select materials to assign to this building element.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="search" className="text-right">
              Search
            </Label>
            <Input
              id="search"
              className="col-span-3"
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[300px] w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Select</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">CO2 Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(material.id)}
                        onChange={() => handleSelectMaterial(material.id)}
                      />
                    </TableCell>
                    <TableCell>{material.name}</TableCell>
                    <TableCell>{material.category}</TableCell>
                    <TableCell className="text-right">{material.co2Impact} kg CO2e/kg</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <Button onClick={() => setShowCustomMaterialDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Custom Material
          </Button>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleAssign}>Assign Selected Materials</Button>
        </DialogFooter>
      </DialogContent>
      <Dialog open={showCustomMaterialDialog} onOpenChange={setShowCustomMaterialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                className="col-span-3"
                value={newCustomMaterial.name}
                onChange={(e) => setNewCustomMaterial({ ...newCustomMaterial, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category
              </Label>
              <Input
                id="category"
                className="col-span-3"
                value={newCustomMaterial.category}
                onChange={(e) => setNewCustomMaterial({ ...newCustomMaterial, category: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="co2Impact" className="text-right">
                CO2 Impact
              </Label>
              <Input
                id="co2Impact"
                className="col-span-3"
                type="number"
                value={newCustomMaterial.co2Impact}
                onChange={(e) => setNewCustomMaterial({ ...newCustomMaterial, co2Impact: parseFloat(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateCustomMaterial}>Create Material</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}