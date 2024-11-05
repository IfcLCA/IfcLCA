"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Project {
  id: string
  name: string
}

interface ExportFormat {
  id: string
  name: string
  extension: string
}

interface ExportSettings {
  includeMetadata: boolean
  includeMaterials: boolean
  includeElementProperties: boolean
  includeLCAResults: boolean
}

interface ExportDialogProps {
  project: Project
  formats: ExportFormat[]
  settings: ExportSettings
  onExport: (format: ExportFormat, settings: ExportSettings) => void
}

export function ExportDialog({ project = { id: '', name: 'Untitled Project' }, formats = [], settings: initialSettings, onExport }: ExportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat | null>(null)
  const [settings, setSettings] = React.useState<ExportSettings>(initialSettings)

  const handleExport = () => {
    if (selectedFormat) {
      onExport(selectedFormat, settings)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Export Project</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Project: {project?.name || 'Untitled Project'}</DialogTitle>
          <DialogDescription>
            Choose export format and customize content to include in the export.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="col-span-3 justify-between"
                >
                  {selectedFormat ? selectedFormat.name : "Select format..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search format..." />
                  <CommandEmpty>No format found.</CommandEmpty>
                  <CommandGroup>
                    {Array.isArray(formats) && formats.map((format) => (
                      <CommandItem
                        key={format.id}
                        onSelect={() => {
                          setSelectedFormat(format)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedFormat?.id === format.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {format.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right col-span-4">Content to include:</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={settings.includeMetadata}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, includeMetadata: checked as boolean })
                }
              />
              <Label htmlFor="metadata">Metadata</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="materials"
                checked={settings.includeMaterials}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, includeMaterials: checked as boolean })
                }
              />
              <Label htmlFor="materials">Materials</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="elementProperties"
                checked={settings.includeElementProperties}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, includeElementProperties: checked as boolean })
                }
              />
              <Label htmlFor="elementProperties">Element Properties</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="lcaResults"
                checked={settings.includeLCAResults}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, includeLCAResults: checked as boolean })
                }
              />
              <Label htmlFor="lcaResults">LCA Results</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleExport} disabled={!selectedFormat}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}