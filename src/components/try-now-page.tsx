"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseIfcWithWasm } from "@/lib/services/ifc-wasm-parser";
import { DataTable } from "@/components/data-table";
import { elementsColumns } from "@/components/elements-columns";
import { materialsColumns } from "@/components/materials-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Fuse from "fuse.js";
import Link from "next/link";
import { useProjectEmissions } from "@/hooks/use-project-emissions";
import { EmissionsSummaryCard } from "@/components/emissions-summary-card";
import NavigationHeader from "@/components/navigation-header";
import MarketingFooter from "@/components/marketing-footer";
import { fileTransferService } from "@/lib/file-transfer";
import {
  Upload,
  FileUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  TreePine,
  Zap,
  Database,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Download,
  Eye,
  X,
  Building2,
  Layers,
  Square,
  Columns3,
  Minus,
  Cuboid,
  Package,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface KBOBMaterial {
  Name: string;
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
  density?: number | string | null; // New API field
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

// Processing stages for progress tracking
const PROCESSING_STAGES = [
  { id: "upload", label: "Uploading file", icon: Upload },
  { id: "parse", label: "Parsing IFC data", icon: FileUp },
  { id: "match", label: "Matching materials", icon: Database },
  { id: "calculate", label: "Calculating emissions", icon: BarChart3 },
  { id: "complete", label: "Analysis complete", icon: CheckCircle },
];

// Dynamic insights that rotate during processing
const PROCESSING_INSIGHTS = [
  "Analyzing building geometry...",
  "Identifying structural elements...",
  "Measuring material volumes...",
  "Checking wall assemblies...",
  "Evaluating slab compositions...",
  "Processing column data...",
  "Calculating environmental impact...",
  "Optimizing data structures...",
  "Validating IFC relationships...",
  "Extracting quantity data...",
];

export default function TryNowPage() {
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [elements, setElements] = useState<ElementEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedView, setSelectedView] = useState<"chart" | "table">("chart");
  const [selectedMetric, setSelectedMetric] = useState<"gwp" | "ubp" | "penre">("gwp");
  const [processingInsight, setProcessingInsight] = useState("");
  const [modelStats, setModelStats] = useState<{
    totalElements: number;
    wallCount: number;
    slabCount: number;
    columnCount: number;
    beamCount: number;
    totalVolume: number;
    uniqueMaterials: number;
  } | null>(null);

  const kbobDataRef = useRef<KBOBMaterial[] | null>(null);
  const fuseRef = useRef<Fuse<KBOBMaterial> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectForEmissions = {
    id: "try-now",
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

  // Check for pending file on mount
  useEffect(() => {
    const pendingFile = fileTransferService.getPendingFile();
    if (pendingFile) {
      // Automatically process the file
      handleFile(pendingFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - handleFile is stable via useCallback

  const findBestMatch = useCallback((name: string): KBOBMaterial | undefined => {
    const kbobData = kbobDataRef.current;
    if (!kbobData) return undefined;
    const lower = name.trim().toLowerCase();
    const exact = kbobData.find((m) => m.Name.trim().toLowerCase() === lower);
    if (exact) return exact;
    if (!fuseRef.current) {
      fuseRef.current = new Fuse(kbobData, {
        keys: ["Name"],
        includeScore: true,
        threshold: 1,
      });
    }
    const results = fuseRef.current.search(name);
    return results.length > 0 ? results[0].item : undefined;
  }, []);

  const calcDensity = useCallback((m?: KBOBMaterial) => {
    if (!m) return undefined;

    // Check new density field first (from updated KBOB API)
    if (m.density !== null && m.density !== undefined) {
      if (typeof m.density === "number" && !isNaN(m.density) && m.density !== 0) {
        return m.density;
      } else if (typeof m.density === "string" && m.density !== "" && m.density !== "-") {
        const parsed = parseFloat(m.density);
        if (!isNaN(parsed) && parsed !== 0) {
          return parsed;
        }
      }
    }

    // Fallback to old fields
    if (typeof m["kg/unit"] === "number") return m["kg/unit"];
    if (
      typeof m["min density"] === "number" &&
      typeof m["max density"] === "number"
    ) {
      return (m["min density"] + m["max density"]) / 2;
    }
    return undefined;
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  const formatValue = (value: number): string => {
    const absValue = Math.abs(value);

    if (absValue >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    } else if (absValue >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    } else if (absValue >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  const formatAxisValue = (value: number): string => {
    const absValue = Math.abs(value);

    if (absValue >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(0)}B`;
    } else if (absValue >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(0)}M`;
    } else if (absValue >= 10_000) {
      return `${(value / 1_000).toFixed(0)}k`;
    } else if (absValue >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  // Update stage with minimum display time for visibility
  const updateStage = useCallback(async (stage: number) => {
    setCurrentStage(stage);

    // Ensure each stage is visible for at least 200ms
    await new Promise(resolve => setTimeout(resolve, 200));

    // Mark stage as completed
    setCompletedStages(prev => [...prev, stage]);
  }, []);

  // Process file with real-time progress updates
  const processFileWithProgress = useCallback(async (file: File) => {
    // Stage 0: Upload (instant, but show it)
    await updateStage(0);

    // Stage 1: Parse IFC
    await updateStage(1);

    // Load KBOB data if needed
    if (!kbobDataRef.current) {
      const res = await fetch("/api/kbob");
      kbobDataRef.current = await res.json();
    }

    // Parse IFC
    const { elements: parsed } = await parseIfcWithWasm(file);

    // Stage 2: Match materials
    await updateStage(2);

    // Calculate model statistics
    const stats = {
      totalElements: parsed.length,
      wallCount: parsed.filter(el => el.type?.toLowerCase().includes('wall')).length,
      slabCount: parsed.filter(el => el.type?.toLowerCase().includes('slab')).length,
      columnCount: parsed.filter(el => el.type?.toLowerCase().includes('column')).length,
      beamCount: parsed.filter(el => el.type?.toLowerCase().includes('beam')).length,
      totalVolume: 0,
      uniqueMaterials: 0,
    };

    // Collect all unique material names
    const uniqueMaterialNames = new Set<string>();
    parsed.forEach((el) => {
      if (el.materials?.length) {
        el.materials.forEach((name) => uniqueMaterialNames.add(name));
      }
      if (el.material_volumes) {
        Object.keys(el.material_volumes).forEach((name) => uniqueMaterialNames.add(name));
      }
    });

    // Match each unique material name only once
    const materialMatchMap = new Map<string, { match?: KBOBMaterial; density?: number }>();
    uniqueMaterialNames.forEach((name) => {
      const match = findBestMatch(name);
      const density = calcDensity(match);
      materialMatchMap.set(name, { match, density });
    });

    // Stage 3: Calculate emissions
    await updateStage(3);

    // Process elements and calculate emissions
    const els: ElementEntry[] = parsed.map((el) => {
      const mats: ElementEntry["materials"] = [];
      const baseVolume = el.volume || 0;

      if (el.materials?.length) {
        el.materials.forEach((name) => {
          const { match, density } = materialMatchMap.get(name) || {};
          mats.push({
            material: { name, density, kbobMatch: match },
            volume: baseVolume / el.materials!.length,
          });
        });
      }

      if (el.material_volumes) {
        Object.entries(el.material_volumes).forEach(([name, data]) => {
          const { match, density } = materialMatchMap.get(name) || {};
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
              (m.material.kbobMatch.gwpTotal ?? 0);
            acc.ubp +=
              m.volume *
              m.material.density *
              (m.material.kbobMatch.ubp21Total ?? 0);
            acc.penre +=
              m.volume *
              m.material.density *
              (m.material.kbobMatch.primaryEnergyNonRenewableTotal ?? 0);
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

    // Aggregate materials
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
            m.volume * m.material.density * (m.material.kbobMatch.gwpTotal ?? 0);
          existing.emissions.ubp +=
            m.volume * m.material.density * (m.material.kbobMatch.ubp21Total ?? 0);
          existing.emissions.penre +=
            m.volume * m.material.density * (m.material.kbobMatch.primaryEnergyNonRenewableTotal ?? 0);
        }
        matMap.set(key, existing);
      });
    });

    // Set final results
    setElements(els);
    setMaterials(Array.from(matMap.values()));

    // Update statistics
    stats.totalVolume = els.reduce((sum, el) => sum + el.totalVolume, 0);
    stats.uniqueMaterials = matMap.size;
    setModelStats(stats);

    // Stage 4: Complete
    await updateStage(4);
  }, [updateStage, findBestMatch, calcDensity]);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError("");
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setCurrentStage(0);
    setCompletedStages([]);

    // Start insight rotation
    const insightInterval = setInterval(() => {
      setProcessingInsight(PROCESSING_INSIGHTS[Math.floor(Math.random() * PROCESSING_INSIGHTS.length)]);
    }, 800);

    try {
      // Process file with real-time stage updates
      await processFileWithProgress(file);

    } catch (err) {
      console.error(err);
      setError("Failed to process the IFC file. Please ensure it contains valid data.");
    } finally {
      clearInterval(insightInterval);
      setProcessingInsight("");
      setLoading(false);
    }
  }, [processFileWithProgress, formatFileSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.ifc')) {
      handleFile(file);
    } else {
      setError("Please upload a valid IFC file");
    }
  }, [handleFile]);

  const resetAnalysis = () => {
    setMaterials([]);
    setElements([]);
    setFileName("");
    setFileSize("");
    setError("");
    setCurrentStage(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Chart data preparation
  const chartData = materials
    .filter(m => m.emissions[selectedMetric] > 0)
    .sort((a, b) => b.emissions[selectedMetric] - a.emissions[selectedMetric])
    .slice(0, 10)
    .map(m => ({
      name: m.material.kbobMatch?.Name || m.name, // KBOB name for axis, fallback to IFC name
      ifcName: m.name, // IFC name for tooltip
      value: m.emissions[selectedMetric],
      volume: m.volume,
    }));

  const pieData = materials
    .filter(m => m.emissions[selectedMetric] > 0)
    .sort((a, b) => b.emissions[selectedMetric] - a.emissions[selectedMetric])
    .slice(0, 5)
    .map(m => ({
      name: m.material.kbobMatch?.Name || m.name, // KBOB name for legend, fallback to IFC name
      ifcName: m.name, // IFC name for tooltip
      value: m.emissions[selectedMetric],
    }));

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case "gwp": return "GWP (kg CO₂-eq)";
      case "ubp": return "UBP (Environmental Points)";
      case "penre": return "PEnr (kWh oil-eq)";
      default: return "";
    }
  };

  const COLORS = [
    "#ff6b35", "#f7931e", "#fdc830", "#95c11f", "#39b54a",
    "#00a79d", "#0093d0", "#2e3192", "#662d91", "#ec008c"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationHeader />

      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-700 dark:text-orange-300 text-sm font-medium">
            <Zap className="w-4 h-4" />
            Try IfcLCA Without an Account
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white">
            Experience Instant{" "}
            <span className="bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
              Environmental Analysis
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Upload your IFC file and see the power of IfcLCA. Your data is processed locally in your browser - nothing is stored.
          </p>
        </motion.div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {!loading && elements.length === 0 ? (
            // Upload Interface
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="max-w-3xl mx-auto overflow-hidden">
                <CardContent className="p-0">
                  <motion.div
                    className={`relative p-12 border-2 border-dashed rounded-lg transition-all duration-300 ${isDragging
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:border-orange-400"
                      }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 opacity-5">
                      <div className="absolute inset-0 bg-grid-pattern" />
                    </div>

                    <div className="relative z-10 text-center space-y-6">
                      <motion.div
                        data-ph-no-capture
                        animate={{
                          scale: isDragging ? 1.1 : 1,
                          rotate: isDragging ? 5 : 0,
                        }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="inline-flex p-6 rounded-full bg-gradient-to-r from-orange-100 to-purple-100 dark:from-orange-900/30 dark:to-purple-900/30"
                      >
                        <Upload className="h-12 w-12 text-orange-600 dark:text-orange-400" />
                      </motion.div>

                      <div className="space-y-2">
                        <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">
                          Drop your IFC file here
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          or click to browse
                        </p>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".ifc"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFile(file);
                        }}
                      />

                      <Button
                        size="lg"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg"
                      >
                        Select IFC File
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>

                      <div className="flex items-center justify-center gap-6 pt-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>100% Browser-based</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>No data stored</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Instant results</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800"
                    >
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Feature highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
                {[
                  {
                    icon: TreePine,
                    title: "Swiss KBOB Data",
                    description: "Access 300+ construction materials from lcadata.ch with precise GWP, UBP, and PEnr values based on Swiss standards",
                  },
                  {
                    icon: Sparkles,
                    title: "Smart Matching",
                    description: "Fuzzy string matching automatically links your IFC material names to KBOB entries, handling variations and typos intelligently",
                  },
                  {
                    icon: BarChart3,
                    title: "Visual Analytics",
                    description: "Interactive bar and pie charts with formatted values, material breakdowns by volume, and exportable results for reports",
                  },
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow">
                      <CardContent className="p-6 text-center space-y-3">
                        <div className="inline-flex p-3 rounded-xl bg-gradient-to-r from-orange-100 to-purple-100 dark:from-orange-900/30 dark:to-purple-900/30">
                          <feature.icon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : loading ? (
            // Processing Animation
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto"
            >
              <Card>
                <CardContent className="p-8 space-y-6">
                  <div className="text-center space-y-4">
                    <motion.div
                      data-ph-no-capture
                      animate={{
                        rotate: 360,
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="inline-flex p-4 rounded-full bg-gradient-to-r from-orange-100 to-purple-100 dark:from-orange-900/30 dark:to-purple-900/30"
                    >
                      <Loader2 className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    </motion.div>

                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                        Processing {fileName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {fileSize}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic insight */}
                  {processingInsight && (
                    <motion.div
                      key={processingInsight}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="text-center"
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        {processingInsight}
                      </p>
                    </motion.div>
                  )}

                  {/* Progress stages */}
                  <div className="space-y-3">
                    {PROCESSING_STAGES.map((stage, index) => {
                      const Icon = stage.icon;
                      const isActive = index === currentStage;
                      const isComplete = completedStages.includes(index);

                      return (
                        <motion.div
                          key={stage.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isActive
                            ? "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                            : isComplete
                              ? "bg-green-50 dark:bg-green-900/20"
                              : "bg-gray-50 dark:bg-gray-800/50"
                            }`}
                        >
                          <div className={`p-2 rounded-full ${isActive
                            ? "bg-orange-100 dark:bg-orange-900/30"
                            : isComplete
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-gray-100 dark:bg-gray-800"
                            }`}>
                            <Icon className={`h-4 w-4 ${isActive
                              ? "text-orange-600 dark:text-orange-400"
                              : isComplete
                                ? "text-green-600 dark:text-green-400"
                                : "text-gray-400 dark:text-gray-600"
                              }`} />
                          </div>
                          <span className={`text-sm font-medium ${isActive
                            ? "text-orange-700 dark:text-orange-300"
                            : isComplete
                              ? "text-green-700 dark:text-green-300"
                              : "text-gray-500 dark:text-gray-400"
                            }`}>
                            {stage.label}
                          </span>
                          {isComplete && (
                            <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                          )}
                          {isActive && (
                            <motion.div
                              data-ph-no-capture
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="ml-auto"
                            >
                              <div className="w-2 h-2 bg-orange-500 rounded-full" />
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            // Results View
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Hero Results Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 md:p-8 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-700/50"
              >
                {/* Subtle gradient overlay matching logo colors */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-violet-500/5 to-pink-500/5 dark:from-cyan-500/10 dark:via-violet-500/10 dark:to-pink-500/10" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-500/10 via-transparent to-transparent blur-3xl dark:from-cyan-500/20" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-pink-500/8 via-transparent to-transparent blur-3xl dark:from-pink-500/15" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
                  <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                      className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500/20 to-pink-500/15 dark:from-cyan-500/30 dark:to-pink-500/20 backdrop-blur-sm border border-cyan-200/50 dark:border-white/10 flex-shrink-0"
                    >
                      <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-cyan-600 dark:text-cyan-300" />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <motion.h2
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate"
                      >
                        Analysis Complete
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-slate-600 dark:text-white/80 text-sm sm:text-base md:text-lg mt-1 truncate"
                      >
                        {fileName} • {fileSize}
                      </motion.p>
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="w-full md:w-auto"
                  >
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={resetAnalysis}
                      className="w-full md:w-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 dark:from-cyan-500 dark:to-blue-500 dark:hover:from-cyan-400 dark:hover:to-blue-400 text-white border-0 shadow-lg shadow-cyan-500/25"
                    >
                      <RefreshCw className="h-5 w-5 mr-2" />
                      New Analysis
                    </Button>
                  </motion.div>
                </div>

                {/* Key Stats Row */}
                {modelStats && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="relative z-10 mt-6 sm:mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
                  >
                    {[
                      { label: "Elements", value: modelStats.totalElements, icon: Building2, className: "bg-gradient-to-b from-cyan-50 to-cyan-100/50 dark:from-cyan-500/20 dark:to-cyan-500/5" },
                      { label: "Volume", value: modelStats.totalVolume, unit: "m³", icon: Cuboid, className: "bg-gradient-to-b from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/5" },
                      { label: "Materials", value: modelStats.uniqueMaterials, icon: Package, className: "bg-gradient-to-b from-violet-50 to-violet-100/50 dark:from-violet-500/20 dark:to-violet-500/5" },
                      ...(modelStats.wallCount > 0 ? [{ label: "Walls", value: modelStats.wallCount, icon: Square, className: "bg-gradient-to-b from-pink-50 to-pink-100/50 dark:from-pink-500/20 dark:to-pink-500/5" }] : []),
                      ...(modelStats.slabCount > 0 ? [{ label: "Slabs", value: modelStats.slabCount, icon: Layers, className: "bg-gradient-to-b from-cyan-50 to-cyan-100/50 dark:from-cyan-500/20 dark:to-cyan-500/5" }] : []),
                      ...(modelStats.columnCount > 0 ? [{ label: "Columns", value: modelStats.columnCount, icon: Columns3, className: "bg-gradient-to-b from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/5" }] : []),
                      ...(modelStats.beamCount > 0 ? [{ label: "Beams", value: modelStats.beamCount, icon: Minus, className: "bg-gradient-to-b from-violet-50 to-violet-100/50 dark:from-violet-500/20 dark:to-violet-500/5" }] : []),
                    ].slice(0, 4).map((stat, index) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                        className={`${stat.className} backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 text-center border border-slate-200/50 dark:border-white/10 hover:border-cyan-300/50 dark:hover:border-white/20 transition-all bg-white/80 dark:bg-transparent`}
                      >
                        <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1.5 sm:mb-2 text-cyan-600 dark:text-cyan-300" />
                        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                          {formatValue(stat.value)}{stat.unit ? <span className="text-sm sm:text-base md:text-lg ml-1 opacity-80">{stat.unit}</span> : ''}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{stat.label}</p>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>

              {/* Emissions Impact Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {[
                  {
                    label: "Global Warming",
                    metric: "gwp" as const,
                    value: totals.gwp,
                    unit: "kg CO₂ eq",
                    gradient: "from-orange-500 to-red-500",
                    icon: "🌡️"
                  },
                  {
                    label: "Environmental Impact",
                    metric: "ubp" as const,
                    value: totals.ubp,
                    unit: "UBP",
                    gradient: "from-purple-500 to-pink-500",
                    icon: "🌍"
                  },
                  {
                    label: "Primary Energy",
                    metric: "penre" as const,
                    value: totals.penre,
                    unit: "kWh oil-eq",
                    gradient: "from-amber-500 to-orange-500",
                    icon: "⚡"
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.metric}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.gradient} p-6 text-white shadow-xl cursor-pointer`}
                    onClick={() => setSelectedMetric(item.metric)}
                  >
                    <div className="absolute top-0 right-0 text-6xl opacity-20 -mr-2 -mt-2">
                      {item.icon}
                    </div>
                    <p className="text-sm font-medium opacity-90 mb-1">{item.label}</p>
                    <p className="text-3xl md:text-4xl font-bold mb-1">
                      {item.value >= 1_000_000
                        ? `${(item.value / 1_000_000).toLocaleString("de-CH", { maximumFractionDigits: 1 })} Mio.`
                        : item.value.toLocaleString("de-CH", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm opacity-80">{item.unit}</p>
                    {selectedMetric === item.metric && (
                      <motion.div
                        layoutId="selected-metric"
                        className="absolute bottom-2 right-2 bg-white/30 rounded-full px-2 py-0.5 text-xs"
                      >
                        Selected
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </motion.div>

              {/* Material Analysis Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
              >
                <Card className="overflow-hidden border-0 shadow-xl">
                  <CardHeader className="bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6 pb-4 sm:pb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                      {/* Title Section */}
                      <div className="flex-shrink-0">
                        <CardTitle className="text-lg sm:text-xl mb-1 text-slate-900 dark:text-white">Material Breakdown</CardTitle>
                        <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm">Detailed analysis of environmental impact by material</p>
                      </div>

                      {/* Controls Section - Right aligned on large screens */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 lg:gap-4 flex-shrink-0 w-full sm:w-auto">
                        {/* Metric Selector - Only show when Charts tab is active, positioned left on large screens */}
                        {selectedView === "chart" && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col w-full sm:w-auto lg:items-center gap-2 order-2 sm:order-1"
                          >
                            {/* Metric Toggle */}
                            <div className="relative flex items-center gap-1 p-1 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm backdrop-blur-sm w-full sm:w-auto">
                              {[
                                { value: "gwp" as const, label: "GWP", gradient: "from-orange-500 to-red-500" },
                                { value: "ubp" as const, label: "UBP", gradient: "from-purple-500 to-pink-500" },
                                { value: "penre" as const, label: "PEnr", gradient: "from-amber-500 to-orange-500" },
                              ].map((metric) => (
                                <button
                                  key={metric.value}
                                  onClick={() => setSelectedMetric(metric.value)}
                                  className={`relative flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-1.5 rounded-md text-xs sm:text-xs font-semibold transition-all duration-300 min-h-[44px] sm:min-h-0 ${selectedMetric === metric.value
                                    ? "text-white shadow-md transform scale-105"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30"
                                    }`}
                                >
                                  {selectedMetric === metric.value && (
                                    <motion.div
                                      layoutId="selected-metric-bg"
                                      className={`absolute inset-0 bg-gradient-to-r ${metric.gradient} rounded-md`}
                                      initial={false}
                                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                  )}
                                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                                    <span>{metric.label}</span>
                                    {selectedMetric === metric.value && (
                                      <motion.span
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="w-1 h-1 bg-white rounded-full"
                                      />
                                    )}
                                  </span>
                                </button>
                              ))}
                            </div>

                            {/* Metric Description - Below toggle, hidden on large screens */}
                            <motion.div
                              key={selectedMetric}
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-xs text-slate-500 dark:text-slate-400 text-left lg:hidden w-full"
                            >
                              <span className="font-medium">
                                {selectedMetric === "gwp" && "Global Warming Potential"}
                                {selectedMetric === "ubp" && "Environmental Impact Points"}
                                {selectedMetric === "penre" && "Primary Energy Non-Renewable"}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 ml-1">
                                {selectedMetric === "gwp" && "(kg CO₂ eq)"}
                                {selectedMetric === "ubp" && "(UBP)"}
                                {selectedMetric === "penre" && "(kWh oil-eq)"}
                              </span>
                            </motion.div>
                          </motion.div>
                        )}

                        {/* View Toggle (Charts/Data) */}
                        <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as "chart" | "table")} className="order-1 sm:order-2">
                          <TabsList className="bg-slate-100 dark:bg-white/10 w-full sm:w-auto">
                            <TabsTrigger value="chart" className="flex-1 sm:flex-initial data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900">
                              <BarChart3 className="h-4 w-4 mr-1.5 sm:mr-2" />
                              Charts
                            </TabsTrigger>
                            <TabsTrigger value="table" className="flex-1 sm:flex-initial data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900">
                              <Eye className="h-4 w-4 mr-1.5 sm:mr-2" />
                              Data
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {selectedView === "chart" ? (
                      <div className="space-y-6">
                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Bar Chart */}
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.1 }}
                            className="space-y-4"
                          >
                            <div>
                              <h4 className="font-semibold text-gray-800 dark:text-white">
                                Top Materials by Impact
                              </h4>
                            </div>
                            <div className="h-[350px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                  <XAxis
                                    type="number"
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={formatAxisValue}
                                  />
                                  <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={120}
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(value) => value.length > 18 ? value.substring(0, 18) + "..." : value}
                                  />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                          <div className="rounded-xl border bg-white dark:bg-slate-800 p-3 shadow-xl">
                                            <p className="font-semibold text-sm mb-1">{data.ifcName}</p>
                                            <div className="space-y-1 text-xs">
                                              <p className="text-orange-600 dark:text-orange-400 font-medium">
                                                {getMetricLabel(selectedMetric)}: {formatValue(data.value)}
                                              </p>
                                              <p className="text-gray-500">
                                                Volume: {data.volume.toFixed(2)} m³
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </motion.div>

                          {/* Pie Chart */}
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.2 }}
                            className="space-y-4"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-gray-800 dark:text-white">
                                Impact Distribution
                              </h4>
                              <span className="text-xs text-gray-500">Top 5 materials</span>
                            </div>
                            <div className="h-[420px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 30, right: 30, bottom: 10, left: 30 }}>
                                  <Pie
                                    data={pieData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={55}
                                    outerRadius={95}
                                    paddingAngle={2}
                                    label={({ cx, cy, midAngle, outerRadius, percent }) => {
                                      const RADIAN = Math.PI / 180;
                                      const radius = outerRadius + 25;
                                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                      return (
                                        <text
                                          x={x}
                                          y={y}
                                          fill="currentColor"
                                          textAnchor={x > cx ? 'start' : 'end'}
                                          dominantBaseline="central"
                                          className="text-sm font-semibold fill-gray-700 dark:fill-gray-300"
                                        >
                                          {`${(percent * 100).toFixed(0)}%`}
                                        </text>
                                      );
                                    }}
                                    labelLine={{ stroke: 'currentColor', strokeWidth: 1, className: 'stroke-gray-400 dark:stroke-gray-500' }}
                                  >
                                    {pieData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                          <div className="rounded-xl border bg-white dark:bg-slate-800 p-3 shadow-xl">
                                            <p className="font-semibold text-sm">{data.ifcName}</p>
                                            <p className="text-xs text-orange-600 dark:text-orange-400">
                                              {formatValue(data.value)} {selectedMetric === 'gwp' ? 'kg CO₂' : selectedMetric === 'ubp' ? 'UBP' : 'kWh'}
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Legend
                                    verticalAlign="bottom"
                                    height={50}
                                    formatter={(value) => (
                                      <span className="text-xs">{value.length > 15 ? value.substring(0, 15) + "..." : value}</span>
                                    )}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        <Tabs defaultValue="materials" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
                            <TabsTrigger value="materials">
                              <Package className="h-4 w-4 mr-2" />
                              Materials ({materials.length})
                            </TabsTrigger>
                            <TabsTrigger value="elements">
                              <Building2 className="h-4 w-4 mr-2" />
                              Elements ({elements.length})
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="materials" className="mt-6">
                            <DataTable
                              columns={materialsColumns}
                              data={materials.map(m => ({
                                ...m,
                                material: {
                                  ...m.material,
                                  density: m.material.density ?? 0
                                }
                              }))}
                            />
                          </TabsContent>
                          <TabsContent value="elements" className="mt-6">
                            <DataTable columns={elementsColumns} data={elements} />
                          </TabsContent>
                        </Tabs>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
              >
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-10 md:p-14 text-white shadow-2xl">
                  {/* Decorative elements */}
                  <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-96 h-96 bg-fuchsia-400/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

                  <div className="relative z-10 max-w-3xl mx-auto text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 1.4 }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm mb-6"
                    >
                      <Sparkles className="h-4 w-4" />
                      Save your results & unlock more
                    </motion.div>

                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                      Ready for Professional LCA?
                    </h2>
                    <p className="text-lg md:text-xl opacity-90 mb-8 max-w-xl mx-auto">
                      Create a free account to save projects, collaborate with your team, and export detailed reports.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <Link href="/sign-up">
                        <Button
                          size="lg"
                          className="bg-white text-purple-600 hover:bg-gray-100 shadow-xl px-8 py-6 text-lg font-semibold"
                        >
                          Get Started Free
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </Link>
                      <Link href="/features">
                        <Button
                          size="lg"
                          variant="outline"
                          className="border-white/50 bg-white/10 text-white hover:bg-white/20 px-8 py-6 text-lg backdrop-blur-sm"
                        >
                          Learn More
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <MarketingFooter />
    </div>
  );
}
