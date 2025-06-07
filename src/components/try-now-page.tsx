"use client";

import { useState, useRef } from "react";
import { parseIfcWithWasm } from "@/lib/services/ifc-wasm-parser";
import { DataTable } from "@/components/data-table";
import { elementsColumns } from "@/components/elements-columns";
import { materialsColumns } from "@/components/materials-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Fuse from "fuse.js";
import Link from "next/link";
import { useProjectEmissions } from "@/hooks/use-project-emissions";
import { EmissionsSummaryCard } from "@/components/emissions-summary-card";

interface KBOBMaterial {
  Name: string;
  GWP: number;
  UBP: number;
  PENRE: number;
  "kg/unit"?: number;
  "min density"?: number;
  "max density"?: number;
}

interface MaterialEntry {
  _id: string;
  name: string;
  material: {
    name: string;
    density?: number;
    kbobMatch?: KBOBMaterial;
  };
  volume: number;
  emissions: {
    gwp: number;
    ubp: number;
    penre: number;
  };
}

interface ElementEntry {
  _id: string;
  name: string;
  type: string;
  totalVolume: number;
  materials: {
    material: {
      name: string;
      density?: number;
      kbobMatch?: KBOBMaterial;
    };
    volume: number;
  }[];
  emissions: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  isExternal: boolean;
  loadBearing: boolean;
}

export default function TryNowPage() {
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [elements, setElements] = useState<ElementEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const kbobDataRef = useRef<KBOBMaterial[] | null>(null);
  const fuseRef = useRef<Fuse<KBOBMaterial> | null>(null);

  const projectForEmissions = {
    elements: elements.map((el) => ({
      materials: el.materials.map((m) => ({
        volume: m.volume,
        material: {
          density: m.material.density,
          kbobMatch: m.material.kbobMatch,
        },
      })),
    })),
  };

  const { totals } = useProjectEmissions(projectForEmissions);

  const findBestMatch = (name: string): KBOBMaterial | undefined => {
    const kbobData = kbobDataRef.current;
    if (!kbobData) return undefined;
    const lower = name.trim().toLowerCase();
    const exact = kbobData.find(
      (m) => m.Name.trim().toLowerCase() === lower
    );
    if (exact) return exact;
    if (!fuseRef.current) {
      fuseRef.current = new Fuse(kbobData, { keys: ["Name"], threshold: 0.3 });
    }
    const result = fuseRef.current.search(name)[0];
    return result?.item;
  };

  const calcDensity = (m?: KBOBMaterial) => {
    if (!m) return undefined;
    if (typeof m["kg/unit"] === "number") return m["kg/unit"];
    if (
      typeof m["min density"] === "number" &&
      typeof m["max density"] === "number"
    ) {
      return (m["min density"] + m["max density"]) / 2;
    }
    return undefined;
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      if (!kbobDataRef.current) {
        const res = await fetch("/api/kbob");
        kbobDataRef.current = await res.json();
      }
      const { elements: parsed } = await parseIfcWithWasm(file);
      const els: ElementEntry[] = parsed.map((el) => {
        const mats: ElementEntry["materials"] = [];
        const baseVolume = el.volume || 0;
        if (el.materials?.length) {
          el.materials.forEach((name) => {
            const match = findBestMatch(name);
            const density = calcDensity(match);
            mats.push({
              material: { name, density, kbobMatch: match },
              volume: baseVolume / el.materials.length,
            });
          });
        }
        if (el.material_volumes) {
          Object.entries(el.material_volumes).forEach(([name, data]) => {
            const match = findBestMatch(name);
            const density = calcDensity(match);
            mats.push({
              material: { name, density, kbobMatch: match },
              volume: (data as any).volume,
            });
          });
        }
        const emissions = mats.reduce(
          (acc, m) => {
            if (m.material.kbobMatch && m.material.density) {
              acc.gwp +=
                m.volume *
                m.material.density *
                m.material.kbobMatch.GWP;
              acc.ubp +=
                m.volume *
                m.material.density *
                m.material.kbobMatch.UBP;
              acc.penre +=
                m.volume *
                m.material.density *
                m.material.kbobMatch.PENRE;
            }
            return acc;
          },
          { gwp: 0, ubp: 0, penre: 0 }
        );
        return {
          _id: el.id,
          name: el.object_type || el.type,
          type: el.type,
          totalVolume: baseVolume,
          materials: mats,
          emissions,
          isExternal: el.properties?.isExternal || false,
          loadBearing: el.properties?.loadBearing || false,
        };
      });

      const matMap = new Map<string, MaterialEntry>();
      els.forEach((el) => {
        el.materials.forEach((m) => {
          const key = m.material.name.toLowerCase();
          const existing = matMap.get(key) || {
            _id: key,
            name: m.material.name,
            material: {
              name: m.material.name,
              density: m.material.density,
              kbobMatch: m.material.kbobMatch,
            },
            volume: 0,
            emissions: { gwp: 0, ubp: 0, penre: 0 },
          };
          existing.volume += m.volume;
          if (m.material.kbobMatch && m.material.density) {
            existing.emissions.gwp +=
              m.volume * m.material.density * m.material.kbobMatch.GWP;
            existing.emissions.ubp +=
              m.volume * m.material.density * m.material.kbobMatch.UBP;
            existing.emissions.penre +=
              m.volume * m.material.density * m.material.kbobMatch.PENRE;
          }
          matMap.set(key, existing);
        });
      });

      setElements(els);
      setMaterials(Array.from(matMap.values()));
    } catch (err) {
      console.error(err);
      alert("Failed to process file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Try IfcLCA</h1>
      <p className="text-muted-foreground">
        Upload an IFC file to preview analysis results. Your data is processed in
        the browser and not stored.
      </p>
      <Input
        type="file"
        accept=".ifc"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {loading && <p className="text-muted-foreground">Processing…</p>}
      {elements.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Emissions Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <EmissionsSummaryCard project={projectForEmissions} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Materials</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable columns={materialsColumns} data={materials} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Elements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable columns={elementsColumns} data={elements} />
            </CardContent>
          </Card>
          <div className="text-center pt-4">
            <Link href="/sign-up">
              <Button size="lg">Create Free Account to Save Results</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
