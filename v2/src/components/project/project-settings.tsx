"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings, X, Save, Loader2 } from "lucide-react";

interface ProjectSettingsProps {
  projectId: string;
  initialValues: {
    name: string;
    description?: string | null;
    areaType?: string | null;
    areaValue?: number | null;
    amortization?: number | null;
  };
  onSaved?: () => void;
}

const AREA_TYPES = [
  { value: "EBF", label: "EBF (Energiebezugsfläche)" },
  { value: "GFA", label: "GFA (Geschossfläche)" },
  { value: "NFA", label: "NFA (Nutzfläche)" },
  { value: "GIA", label: "GIA (Gross Internal Area)" },
];

export function ProjectSettings({
  projectId,
  initialValues,
  onSaved,
}: ProjectSettingsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(
    initialValues.description ?? ""
  );
  const [areaType, setAreaType] = useState(initialValues.areaType ?? "EBF");
  const [areaValue, setAreaValue] = useState(
    initialValues.areaValue?.toString() ?? ""
  );
  const [amortization, setAmortization] = useState(
    (initialValues.amortization ?? 50).toString()
  );

  useEffect(() => {
    setName(initialValues.name);
    setDescription(initialValues.description ?? "");
    setAreaType(initialValues.areaType ?? "EBF");
    setAreaValue(initialValues.areaValue?.toString() ?? "");
    setAmortization((initialValues.amortization ?? 50).toString());
  }, [initialValues]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || initialValues.name,
          description: description.trim() || null,
          areaType,
          areaValue: areaValue ? parseFloat(areaValue) : null,
          amortization: amortization ? parseInt(amortization, 10) : 50,
        }),
      });
      setOpen(false);
      onSaved?.();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(true)}
        title="Project settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Project Settings</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Reference Area */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Area Type</label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                {AREA_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>
                    {at.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Area (m²)</label>
              <input
                type="number"
                value={areaValue}
                onChange={(e) => setAreaValue(e.target.value)}
                placeholder="e.g. 1200"
                min={0}
                step={0.1}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Amortization */}
          <div>
            <label className="text-sm font-medium">
              Amortization Period (years)
            </label>
            <input
              type="number"
              value={amortization}
              onChange={(e) => setAmortization(e.target.value)}
              min={1}
              max={100}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used for per m²·year relative emission calculation (default: 50
              years)
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
