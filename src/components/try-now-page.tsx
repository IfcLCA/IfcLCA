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
      name: m.name,
      value: m.emissions[selectedMetric],
      volume: m.volume,
    }));

  const pieData = materials
    .filter(m => m.emissions[selectedMetric] > 0)
    .sort((a, b) => b.emissions[selectedMetric] - a.emissions[selectedMetric])
    .slice(0, 5)
    .map(m => ({
      name: m.name,
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
              className="space-y-6"
            >
              {/* File info and actions */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {fileName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Analysis complete • {fileSize} • {modelStats?.totalElements} elements
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAnalysis}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      New Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Model Statistics - NEW */}
              {modelStats && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4"
                >
                  {[
                    { label: "Total Elements", value: modelStats.totalElements, icon: Building2 },
                    { label: "Walls", value: modelStats.wallCount, icon: Square },
                    { label: "Slabs", value: modelStats.slabCount, icon: Layers },
                    { label: "Columns", value: modelStats.columnCount, icon: Columns3 },
                    { label: "Beams", value: modelStats.beamCount, icon: Minus },
                    { label: "Total Volume", value: modelStats.totalVolume, unit: "m³", icon: Cuboid },
                    { label: "Materials", value: modelStats.uniqueMaterials, icon: Package },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 text-center">
                          <stat.icon className="h-5 w-5 mx-auto mb-2 text-gray-400" />
                          <p className="text-2xl font-bold text-gray-800 dark:text-white">
                            {formatValue(stat.value)}{stat.unit ? ` ${stat.unit}` : ''}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {stat.label}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Emissions Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Environmental Impact Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmissionsSummaryCard project={projectForEmissions} />
                </CardContent>
              </Card>

              {/* Visualization Tabs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Material Analysis</CardTitle>
                    <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
                      <TabsList>
                        <TabsTrigger value="chart">
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Charts
                        </TabsTrigger>
                        <TabsTrigger value="table">
                          <Eye className="h-4 w-4 mr-2" />
                          Tables
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedView === "chart" ? (
                    <div className="space-y-6">
                      {/* Metric selector */}
                      <div className="flex justify-center">
                        <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)}>
                          <TabsList>
                            <TabsTrigger value="gwp">GWP</TabsTrigger>
                            <TabsTrigger value="ubp">UBP</TabsTrigger>
                            <TabsTrigger value="penre">PEnr</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      {/* Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bar Chart */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Top 10 Materials by {getMetricLabel(selectedMetric)}
                          </h4>
                          <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="name"
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                  interval={0}
                                  tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                  tick={{ fontSize: 12 }}
                                  tickFormatter={formatAxisValue}
                                />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="rounded-lg border bg-background p-2 shadow-md">
                                          <p className="font-semibold">{data.name}</p>
                                          <p className="text-sm">
                                            {getMetricLabel(selectedMetric)}: {formatValue(data.value)}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            Volume: {data.volume.toFixed(2)} m³
                                          </p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Pie Chart */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Distribution by {getMetricLabel(selectedMetric)}
                          </h4>
                          <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={120}
                                  label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                                  labelLine={false}
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
                                        <div className="rounded-lg border bg-background p-2 shadow-md">
                                          <p className="font-semibold">{data.name}</p>
                                          <p className="text-sm">
                                            {getMetricLabel(selectedMetric)}: {formatValue(data.value)}
                                          </p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend
                                  verticalAlign="bottom"
                                  height={36}
                                  formatter={(value) => value.length > 20 ? value.substring(0, 20) + "..." : value}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <Tabs defaultValue="materials" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="materials">Materials</TabsTrigger>
                          <TabsTrigger value="elements">Elements</TabsTrigger>
                        </TabsList>
                        <TabsContent value="materials" className="mt-6">
                          <DataTable
                            columns={materialsColumns}
                            data={materials.map(m => ({
                              ...m,
                              material: {
                                ...m.material,
                                density: m.material.density ?? 0 // Provide default value of 0 if density is undefined
                              }
                            }))}
                          />
                        </TabsContent>
                        <TabsContent value="elements" className="mt-6">
                          <DataTable columns={elementsColumns} data={elements} />
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-gradient-to-r from-orange-600 to-purple-600 text-white overflow-hidden relative">
                  <motion.div
                    className="absolute inset-0 bg-white/10"
                    animate={{
                      backgroundImage: [
                        "radial-gradient(circle at 20% 50%, transparent 0%, transparent 50%, white 50%, white 60%, transparent 60%)",
                        "radial-gradient(circle at 80% 50%, transparent 0%, transparent 50%, white 50%, white 60%, transparent 60%)",
                        "radial-gradient(circle at 20% 50%, transparent 0%, transparent 50%, white 50%, white 60%, transparent 60%)",
                      ],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <CardContent className="p-12 text-center relative z-10">
                    <h2 className="text-4xl font-bold mb-4">
                      Ready to Transform Your Life Cycle Analysis?
                    </h2>
                    <p className="text-xl mb-8 opacity-90">
                      Create a free account to save your results and unlock advanced features.
                    </p>
                    <Link href="/sign-up">
                      <Button
                        size="lg"
                        className="bg-white text-orange-600 hover:bg-gray-100 shadow-xl px-8 py-6 text-lg"
                      >
                        Create Free Account
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <MarketingFooter />
    </div>
  );
}
