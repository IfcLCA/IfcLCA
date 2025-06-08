"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useBeforeUnload } from "next/navigation";

import { MaterialChangesPreviewModal } from "@/components/material-changes-preview-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  MagnifyingGlassIcon,
  ReloadIcon,
  StarFilledIcon,
  StarIcon,
} from "@radix-ui/react-icons";
import { Trash2Icon } from "lucide-react";
import { MaterialChange } from "@/types/material";
import Fuse from "fuse.js";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import confetti from "canvas-confetti";
import { CheckIcon } from "@radix-ui/react-icons";

interface Material {
  id: string;
  name: string;
  category?: string;
  volume?: number;
  density?: number;
  kbobMatchId?: string;
  kbobMatch?: {
    id: string;
    Name: string;
    GWP: number;
    UBP: number;
    PENRE: number;
  };
  projects?: string[];
  originalIds?: string[];
}

interface KbobMaterial {
  _id: string;
  KBOB_ID: number;
  Name: string;
  GWP: number;
  UBP: number;
  PENRE: number;
  "min density"?: number;
  "max density"?: number;
  "kg/unit"?: number;
}

interface Project {
  id: string;
  name: string;
  materialIds: string[];
}

// Add this new type for auto-suggested matches
interface AutoSuggestedMatch {
  kbobId: string;
  score: number;
  name: string;
}

export function MaterialLibraryComponent() {
  const router = useRouter();
  const pathname = usePathname();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<"name" | "projects">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [kbobMaterials, setKbobMaterials] = useState<KbobMaterial[]>([]);
  const [kbobSearchTerm, setKbobSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<
    Array<{ id: string; name: string; materialIds: string[] }>
  >([]);
  const [isMatchingInProgress, setIsMatchingInProgress] = useState(false);
  const [isKbobOpen, setIsKbobOpen] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<MaterialChange[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [favoriteMaterials, setFavoriteMaterials] = useState<string[]>([]);
  const [selectedKbobId, setSelectedKbobId] = useState<string | null>(null);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [temporaryMatches, setTemporaryMatches] = useState<
    Record<string, string>
  >({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(
    null
  );
  const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);
  const [elementCount, setElementCount] = useState<number>(0);
  const kbobListRef = useRef<HTMLDivElement>(null);
  const [autoSuggestedMatches, setAutoSuggestedMatches] = useState<
    Record<string, AutoSuggestedMatch>
  >({});
  const fuseRef = useRef<Fuse<KbobMaterial> | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (kbobMaterials.length > 0) {
      fuseRef.current = new Fuse(kbobMaterials, {
        keys: ["Name"],
        threshold: 0.8,
        ignoreLocation: true,
        findAllMatches: true,
        getFn: (obj, path) => {
          const value = Fuse.config.getFn(obj, path);
          if (!value) return "";
          return value
            .toString()
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        },
      });

      // Generate suggestions for unmatched materials
      generateSuggestions();
    }
  }, [kbobMaterials, materials]);

  // Add function to generate suggestions
  const generateSuggestions = useCallback(() => {
    if (!fuseRef.current) return;

    const suggestions: Record<string, AutoSuggestedMatch> = {};

    materials.forEach((material) => {
      // Skip if material already has a match
      if (material.kbobMatchId || temporaryMatches[material.id]) return;

      const searchTerm = material.name
        .toLowerCase()
        .replace(/[_-]/g, " ")
        .replace(/\d+/g, "")
        .trim();

      const results = fuseRef.current.search(searchTerm);
      if (results.length > 0) {
        const bestMatch = results[0];
        suggestions[material.id] = {
          kbobId: bestMatch.item._id,
          score: bestMatch.score || 1,
          name: bestMatch.item.Name,
        };
      }
    });

    setAutoSuggestedMatches(suggestions);
  }, [materials, temporaryMatches]);

  const scrollToMatchingKbob = useCallback(
    (ifcMaterialName: string) => {
      if (
        !autoScrollEnabled ||
        !fuseRef.current ||
        !ifcMaterialName ||
        !kbobListRef.current
      )
        return;

      // Preprocess the search term
      const searchTerm = ifcMaterialName
        .toLowerCase()
        .replace(/[_-]/g, " ") // Replace underscores and hyphens with spaces
        .replace(/\d+/g, "") // Remove numbers
        .trim();

      console.log("🔍 Searching for match for:", ifcMaterialName);
      console.log("🔍 Preprocessed search term:", searchTerm);

      const results = fuseRef.current.search(searchTerm);

      console.log(
        "📊 Top matches:",
        results.slice(0, 3).map((result) => ({
          name: result.item.Name,
          score: result.score,
          refId: result.item._id,
          searchTerm: searchTerm,
          normalizedName: result.item.Name.toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .trim(),
        }))
      );

      if (results.length > 0) {
        const bestMatch = results[0].item;
        console.log("✅ Best match:", {
          name: bestMatch.Name,
          id: bestMatch._id,
          score: results[0].score,
        });

        const element = kbobListRef.current.querySelector(
          `[data-kbob-id="${bestMatch._id}"]`
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          console.log("📜 Scrolled to element");
        } else {
          console.log("❌ Element not found in DOM");
        }
      } else {
        console.log("❌ No matches found");
      }
    },
    [autoScrollEnabled]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [materialsRes, kbobRes, projectsRes] = await Promise.all([
          fetch("/api/materials"),
          fetch("/api/kbob"),
          fetch("/api/materials/projects"),
        ]);

        if (!materialsRes.ok || !kbobRes.ok || !projectsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const [materialsData, kbobData, projectsData] = await Promise.all([
          materialsRes.json(),
          kbobRes.json(),
          projectsRes.json(),
        ]);

        // Initialize materials with empty array if undefined
        setMaterials(Array.isArray(materialsData) ? materialsData : []);
        setKbobMaterials(kbobData);
        setProjects(projectsData);

        // Check URL parameters for projectId
        const urlParams = new URLSearchParams(window.location.search);
        const projectIdFromUrl = urlParams.get("projectId");
        if (projectIdFromUrl) {
          setSelectedProject(projectIdFromUrl);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredAndSortedMaterials = useMemo(() => {
    // Ensure materials is an array
    const materialsList = Array.isArray(materials) ? materials : [];

    let filtered = [...materialsList];

    if (selectedProject) {
      // When a specific project is selected, show all materials for that project
      const project = projects.find((p) => p.id === selectedProject);
      if (project) {
        filtered = filtered.filter((material) =>
          project.materialIds.includes(material.id)
        );
      }
    }

    // Add project names to each material
    filtered = filtered.map((material) => ({
      ...material,
      projects: projects
        .filter((project) => project.materialIds.includes(material.id))
        .map((project) => project.name),
    }));

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (material) =>
          material.name.toLowerCase().includes(term) ||
          material.category?.toLowerCase().includes(term) ||
          material.kbobMatch?.Name.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => {
      if (sortColumn === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return 0;
    });
  }, [
    materials,
    searchTerm,
    sortColumn,
    sortDirection,
    selectedProject,
    projects,
  ]);

  const getMaterialProjects = useCallback(
    (materialId: string) => {
      return projects
        .filter((project) => project.materialIds.includes(materialId))
        .map((project) => project.name)
        .join(", ");
    },
    [projects]
  );

  const handleSelect = useCallback((material: Material) => {
    setSelectedMaterials((prev) => {
      const isCurrentlySelected = prev.includes(material.id);
      return isCurrentlySelected
        ? prev.filter((id) => id !== material.id)
        : [...prev, material.id];
    });
  }, []);

  const isSelected = useCallback(
    (material: Material & { originalIds?: string[] }) => {
      const idsToCheck = material.originalIds || [material.id];
      return idsToCheck.some((id) => selectedMaterials.includes(id));
    },
    [selectedMaterials]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Get all IDs including those from grouped materials
      const allIds = filteredAndSortedMaterials.flatMap(
        (material) => material.originalIds || [material.id]
      );
      setSelectedMaterials(allIds);
    } else {
      setSelectedMaterials([]);
    }
  };

  const handleMatch = (materialIds: string[], kbobId: string | null) => {
    const newMatches = { ...temporaryMatches };
    materialIds.forEach((id) => {
      if (kbobId) {
        newMatches[id] = kbobId;
      } else {
        delete newMatches[id];
      }
    });
    setTemporaryMatches(newMatches);
  };

  const handleConfirmMatch = async (changesWithDensity: MaterialChange[]) => {
    try {
      setIsMatchingInProgress(true);

      // Convert changes into the format expected by the API
      const matchPromises = changesWithDensity.map(async (change) => {
        const response = await fetch("/api/materials/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            materialIds: [change.materialId],
            kbobMaterialId: change.newMatch.id,
            density: change.selectedDensity || change.newMatch.Density,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to match material ${change.materialId}`);
        }
      });

      // Wait for all matches to be applied
      await Promise.all(matchPromises);

      // Refresh materials
      const materialsResponse = await fetch("/api/materials");
      if (!materialsResponse.ok) {
        throw new Error("Failed to fetch updated materials");
      }
      const updatedMaterials = await materialsResponse.json();
      setMaterials(updatedMaterials);

      // Reset states
      setTemporaryMatches({});
      setShowPreview(false);
      setKbobSearchTerm("");
      setActiveSearchId(null);

      // Show success message
      toast({
        title: "Success",
        description: "Material matches have been applied successfully.",
      });
    } catch (error) {
      console.error("Failed to apply matches:", error);
      toast({
        title: "Error",
        description: "Failed to apply matches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMatchingInProgress(false);
    }
  };

  const handleCancelMatch = () => {
    setShowPreview(false);
  };

  const getPreviewChanges = async () => {
    const materialIds = Object.keys(temporaryMatches);

    // Fetch element counts
    const elementCountsResponse = await fetch("/api/materials/element-counts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ materialIds }),
    });

    if (!elementCountsResponse.ok) {
      console.error("Failed to fetch element counts");
      return [];
    }

    const elementCounts = await elementCountsResponse.json();

    return Object.entries(temporaryMatches)
      .map(([materialId, kbobId]) => {
        const material = materials.find((m) => m.id === materialId);
        const kbobMaterial = kbobMaterials.find((m) => m._id === kbobId);
        if (!material || !kbobMaterial) return null;

        // Get affected projects with both id and name for navigation
        const affectedProjects = projects.filter((p) =>
          p.materialIds.includes(materialId)
        );

        // Get the first project ID for navigation (assuming one material belongs to one project)
        const projectId = affectedProjects[0]?.id;

        // Get element count from the fetched counts
        const elementCount = elementCounts[materialId] || 0;

        // Get the current material's density from the existing match
        const currentDensity = material.density || 0;

        // Check if material has a density range
        const hasDensityRange =
          typeof kbobMaterial["min density"] === "number" &&
          typeof kbobMaterial["max density"] === "number";

        // Get the new density from the KBOB material
        const newDensity =
          typeof kbobMaterial["kg/unit"] === "number"
            ? kbobMaterial["kg/unit"]
            : hasDensityRange
            ? (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2
            : currentDensity;

        return {
          materialId,
          materialName: material.name,
          oldMatch: material.kbobMatch
            ? {
                Name: material.kbobMatch.Name,
                Density: currentDensity,
                Elements: elementCount,
              }
            : null,
          newMatch: {
            id: kbobMaterial._id,
            Name: kbobMaterial.Name,
            Density: newDensity,
            Elements: elementCount,
            hasDensityRange,
            minDensity: hasDensityRange
              ? kbobMaterial["min density"]
              : undefined,
            maxDensity: hasDensityRange
              ? kbobMaterial["max density"]
              : undefined,
          },
          projects: affectedProjects.map((p) => p.name),
          projectId,
          elements: elementCount,
        };
      })
      .filter(Boolean);
  };

  const handleShowPreview = async () => {
    setIsMatchingInProgress(true);
    try {
      const changes = await getPreviewChanges();
      setPreviewChanges(changes as MaterialChange[]);
      setShowPreview(true);
    } catch (error) {
      console.error("Failed to prepare preview:", error);
      toast({
        title: "Error",
        description: "Failed to prepare preview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMatchingInProgress(false);
    }
  };

  const handleNavigateToProject = (projectId: string) => {
    if (hasUnappliedMatches()) {
      setPendingNavigation(`/projects/${projectId}`);
      setShowLeaveWarning(true);
    } else {
      router.push(`/projects/${projectId}`);
    }
  };

  const toggleSort = (column: "name" | "projects") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const allProjects = useMemo(() => {
    const projectSet = new Set<string>();
    materials.forEach((material) =>
      material.projects?.forEach((project) => projectSet.add(project))
    );
    return Array.from(projectSet).sort();
  }, [materials]);

  const sortedKbobMaterials = useMemo(() => {
    return [...kbobMaterials].sort((a, b) => {
      const aFav = favoriteMaterials.includes(a._id);
      const bFav = favoriteMaterials.includes(b._id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.Name?.localeCompare(b.Name || "") || 0;
    });
  }, [kbobMaterials, favoriteMaterials]);

  const commonWords = useMemo(() => {
    const words = new Map<string, number>();
    kbobMaterials.forEach((material) => {
      if (!material.Name) return;
      const wordList = material.Name.split(/[\s,.-]+/).filter(
        (w) => w.length > 2
      );
      wordList.forEach((word) => {
        words.set(word.toLowerCase(), (words.get(word.toLowerCase()) || 0) + 1);
      });
    });
    return Array.from(words.entries())
      .filter(([_, count]) => count > 1) // Only keep words that appear more than once
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }, [kbobMaterials]);

  const commonPhrases = useMemo(() => {
    const phrases = new Map<string, number>();
    kbobMaterials.forEach((material) => {
      if (!material.Name) return;
      // Get 2-3 word phrases
      const words = material.Name.split(/[\s,.-]+/).filter((w) => w.length > 2);
      for (let i = 0; i < words.length - 1; i++) {
        const twoWords = `${words[i]} ${words[i + 1]}`.toLowerCase();
        phrases.set(twoWords, (phrases.get(twoWords) || 0) + 1);
        if (i < words.length - 2) {
          const threeWords = `${words[i]} ${words[i + 1]} ${
            words[i + 2]
          }`.toLowerCase();
          phrases.set(threeWords, (phrases.get(threeWords) || 0) + 1);
        }
      }
    });
    // Convert to array and sort by frequency
    return Array.from(phrases.entries())
      .filter(([_, count]) => count > 1) // Only keep phrases that appear more than once
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase);
  }, [kbobMaterials]);

  // Normalize text for comparison (handle special characters, case, etc.)
  const normalizeText = (text: string) => {
    return (
      text
        .toLowerCase()
        // Replace special characters with their basic form
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        // Replace special characters and punctuation
        .replace(/[^a-z0-9\s]/g, "")
        // Replace multiple spaces with single space
        .replace(/\s+/g, " ")
        .trim()
    );
  };

  const getSuggestions = useCallback(
    (input: string) => {
      if (!input || input.length < 2) return [];
      const searchTerm = normalizeText(input);

      // First, get exact favorites matches
      const favoriteMatches = sortedKbobMaterials
        .filter((m) => {
          if (!m.Name) return false;
          const normalizedName = normalizeText(m.Name);
          return (
            favoriteMaterials.includes(m._id) &&
            normalizedName.includes(searchTerm)
          );
        })
        .slice(0, 3)
        .map((m) => ({ type: "favorite" as const, text: m.Name, id: m._id }));

      // Then, get phrase suggestions
      const phraseMatches = commonPhrases
        .filter((phrase) => normalizeText(phrase).includes(searchTerm))
        .slice(0, 3)
        .map((phrase) => ({ type: "phrase" as const, text: phrase, id: null }));

      // Finally, get word suggestions
      const wordMatches = commonWords
        .filter((word) => normalizeText(word).includes(searchTerm))
        .slice(0, 3)
        .map((word) => ({ type: "word" as const, text: word, id: null }));

      return [...favoriteMatches, ...phraseMatches, ...wordMatches];
    },
    [commonPhrases, commonWords, sortedKbobMaterials, favoriteMaterials]
  );

  const toggleFavorite = useCallback((materialId: string) => {
    setFavoriteMaterials((prev) => {
      if (prev.includes(materialId)) {
        return prev.filter((id) => id !== materialId);
      } else {
        return [...prev, materialId];
      }
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsKbobOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getTemporaryMatch = (materialId: string) => {
    const kbobId = temporaryMatches[materialId];
    if (!kbobId) return null;
    return kbobMaterials.find((material) => material._id === kbobId);
  };

  const getMatchingProgress = () => {
    const totalMaterials = filteredAndSortedMaterials.length;
    const matchedCount = filteredAndSortedMaterials.filter(
      (material) => temporaryMatches[material.id] || material.kbobMatchId
    ).length;
    return {
      totalMaterials,
      matchedCount,
      percentage: (matchedCount / totalMaterials) * 100,
    };
  };

  const getElementCount = async (materialId: string): Promise<number> => {
    try {
      const response = await fetch("/api/materials/element-counts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ materialIds: [materialId] }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch element count");
      }

      const data = await response.json();
      return data[materialId] || 0;
    } catch (error) {
      console.error("Error fetching element count:", error);
      return 0;
    }
  };

  const handleDeleteMaterial = async (material: Material) => {
    try {
      setIsDeletingMaterial(true);

      const response = await fetch(`/api/materials/${material.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete material");
      }

      // Update local state by removing the deleted material
      setMaterials((prevMaterials) =>
        prevMaterials.filter((m) => m.id !== material.id)
      );

      toast({
        title: "Material deleted",
        description: "The material has been successfully removed.",
      });

      setMaterialToDelete(null);
    } catch (error) {
      console.error("Error deleting material:", error);
      toast({
        title: "Error",
        description: "Failed to delete material. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingMaterial(false);
    }
  };

  // Add this function to trigger confetti
  const triggerMatchConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [
        "#2563eb", // Blue
        "#4f46e5", // Indigo
        "#6366f1", // Primary blue
        "#7c3aed", // Violet
        "#8b5cf6", // Purple
        "#a855f7", // Purple/Pink
        "#d946ef", // Pink
        "#ec4899", // Pink/Red
        "#f97316", // Orange accent
      ],
    });
  }, []);

  // Modify handleBulkMatch to include animation and confetti
  const handleBulkMatch = useCallback(
    (kbobId: string) => {
      if (selectedMaterials.length === 0) return;

      handleMatch(selectedMaterials, kbobId);

      // Trigger confetti for successful match
      if (selectedMaterials.length >= 3) {
        // More confetti for bulk matches
        triggerMatchConfetti();
        setTimeout(triggerMatchConfetti, 150);
      } else {
        triggerMatchConfetti();
      }

      setSelectedMaterials([]);
      setActiveSearchId(null);
    },
    [selectedMaterials, handleMatch, triggerMatchConfetti]
  );

  // Accept all auto-suggested matches and open the preview
  const handleAcceptAllSuggestions = useCallback(() => {
    const suggestions = Object.entries(autoSuggestedMatches).filter(([id]) => {
      const material = materials.find((m) => m.id === id);
      return material && !material.kbobMatchId && !temporaryMatches[id];
    });

    if (suggestions.length === 0) return;

    const newMatches = { ...temporaryMatches };
    suggestions.forEach(([id, suggestion]) => {
      newMatches[id] = suggestion.kbobId;
    });

    setTemporaryMatches(newMatches);
    setSelectedMaterials([]);
    triggerMatchConfetti();
    handleShowPreview();
  }, [autoSuggestedMatches, materials, temporaryMatches, triggerMatchConfetti]);

  // Modify the hasUnappliedMatches function to check for preview modal
  const hasUnappliedMatches = () => {
    // Don't show warning if preview modal is open
    if (showPreview) return false;
    return Object.keys(temporaryMatches).length > 0;
  };

  // Add this effect to handle Next.js navigation
  useEffect(() => {
    if (!hasUnappliedMatches()) return;

    const handleWindowClose = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return (e.returnValue = "");
    };

    const handlePushState = () => {
      if (hasUnappliedMatches()) {
        // Prevent navigation and show warning
        window.history.pushState(null, "", pathname);
        setShowLeaveWarning(true);
      }
    };

    window.addEventListener("beforeunload", handleWindowClose);
    window.addEventListener("popstate", handlePushState);

    // Intercept all navigation attempts
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link?.getAttribute("href")?.startsWith("/")) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigation(link.getAttribute("href"));
        setShowLeaveWarning(true);
      }
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
      window.removeEventListener("popstate", handlePushState);
      document.removeEventListener("click", handleClick, true);
    };
  }, [hasUnappliedMatches, pathname]);

  // Modify handleConfirmNavigation
  const handleConfirmNavigation = () => {
    if (pendingNavigation) {
      setShowLeaveWarning(false);
      setPendingNavigation(null);
      router.push(pendingNavigation);
    }
  };

  // Add this function to handle showing preview from warning
  const handleShowPreviewFromWarning = () => {
    setShowLeaveWarning(false);
    handleShowPreview();
  };

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <Card className="h-[calc(100vh-6rem)] flex flex-col overflow-hidden border-0 shadow-none -mt-14">
      <CardHeader className="pb-0 flex-shrink-0 px-0">
        <div className="flex items-center justify-between">
          <div></div>
          <div className="flex items-center gap-4">
            <Select
              value={selectedProject || "all"}
              onValueChange={(value) =>
                setSelectedProject(value === "all" ? null : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {Object.keys(autoSuggestedMatches).length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleAcceptAllSuggestions}
                >
                  Accept All ({Object.keys(autoSuggestedMatches).length})
                </Button>
              )}
              <Button onClick={handleShowPreview}>Preview Changes</Button>
              {Object.keys(temporaryMatches).length > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-yellow-100 text-yellow-800"
                >
                  {Object.keys(temporaryMatches).length} unapplied matches
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-6 min-h-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <ReloadIcon className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Left Column - Ifc Model Materials */}
            <div className="flex flex-col border rounded-lg overflow-hidden h-full">
              <div className="p-4 border-b bg-secondary/10 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span>Ifc Materials</span>
                    {selectedMaterials.length > 0 && (
                      <Badge variant="secondary" className="animate-in fade-in">
                        {selectedMaterials.length} selected
                      </Badge>
                    )}
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-24 h-2 bg-secondary/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{
                              width: `${getMatchingProgress().percentage}%`,
                            }}
                          />
                        </div>
                        <Badge
                          variant={
                            getMatchingProgress().percentage === 100
                              ? "success"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {getMatchingProgress().matchedCount}/
                          {getMatchingProgress().totalMaterials}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {selectedMaterials.length > 0
                    ? `Select a KBOB material to match with ${selectedMaterials.length} selected materials`
                    : "Select materials from the left to match them with KBOB materials"}
                </p>
                <div className="flex items-center gap-2">
                  <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search model materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="divide-y divide-transparent px-2">
                  {filteredAndSortedMaterials.map((material) => (
                    <div
                      key={material.id}
                      className={`
                        relative p-4 cursor-pointer
                        transition-all duration-300 ease-out
                        hover:bg-secondary/5 hover:scale-[1.02] hover:z-10
                        group
                        ${
                          isSelected(material)
                            ? "ring-2 ring-primary/50 ring-offset-1 shadow-sm bg-primary/5 z-10"
                            : "hover:ring-1 hover:ring-primary/30"
                        }
                        ${
                          temporaryMatches[material.id]
                            ? "animate-in zoom-in-95 duration-500 ease-spring slide-in-from-left-5"
                            : ""
                        }
                        rounded-md my-2
                      `}
                      onClick={() => {
                        handleSelect(material);
                        if (selectedMaterials.length === 0) {
                          scrollToMatchingKbob(material.name);
                        }
                      }}
                    >
                      {temporaryMatches[material.id] && (
                        <div
                          className="absolute inset-0 bg-primary/5 
                            animate-in fade-in duration-500 ease-spring"
                        >
                          <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                            animate-in zoom-in-50 duration-300 ease-spring"
                          >
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <CheckIcon className="w-6 h-6 text-primary animate-in zoom-in duration-300 delay-150" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 z-20">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMaterialToDelete(material);
                                // Fetch and set element count when opening dialog
                                getElementCount(material.id).then(
                                  setElementCount
                                );
                              }}
                            >
                              <Trash2Icon className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Material
                              </AlertDialogTitle>
                              <AlertDialogDescription className="space-y-2">
                                <p>
                                  Are you sure you want to delete{" "}
                                  <span className="font-medium">
                                    {material.name}
                                  </span>
                                  ?
                                </p>
                                <div className="text-sm text-muted-foreground mt-2">
                                  <p>This will affect:</p>
                                  <ul className="list-disc list-inside mt-1">
                                    {material.projects &&
                                      material.projects[0] && (
                                        <li>Project: {material.projects[0]}</li>
                                      )}
                                    <li>
                                      <span className="font-medium">
                                        {elementCount} element
                                        {elementCount !== 1 ? "s" : ""}
                                      </span>{" "}
                                      will be affected
                                    </li>
                                  </ul>
                                </div>
                                <p className="text-sm text-destructive mt-4">
                                  This action cannot be undone.
                                </p>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMaterialToDelete(null);
                                }}
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMaterial(material);
                                }}
                                disabled={isDeletingMaterial}
                              >
                                {isDeletingMaterial ? (
                                  <>
                                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  "Delete"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <div
                        className={`
                        flex items-start justify-between gap-4
                        ${
                          temporaryMatches[material.id]
                            ? "animate-in slide-in-from-left-1 duration-300"
                            : ""
                        }
                        relative z-10
                      `}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">
                              {material.name}
                            </h3>
                            {material.category && (
                              <Badge variant="outline" className="shrink-0">
                                {material.category}
                              </Badge>
                            )}
                          </div>
                          {material.volume && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Volume: {material.volume.toFixed(2)} m³
                            </p>
                          )}
                          {material.projects &&
                            material.projects.length > 0 && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Projects: {material.projects.join(", ")}
                              </p>
                            )}
                          {temporaryMatches[material.id] ||
                          material.kbobMatchId ? (
                            <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-secondary/20 rounded-md">
                              <div className="flex-1 min-w-0">
                                {temporaryMatches[material.id] ? (
                                  <>
                                    <p className="font-medium text-sm truncate">
                                      {getTemporaryMatch(material.id)?.Name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      GWP: {getTemporaryMatch(material.id)?.GWP}{" "}
                                      kg CO₂-eq
                                    </p>
                                  </>
                                ) : material.kbobMatch ? (
                                  <>
                                    <p className="font-medium text-sm truncate">
                                      {material.kbobMatch.Name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      GWP: {material.kbobMatch.GWP} kg CO₂-eq
                                    </p>
                                  </>
                                ) : null}
                              </div>
                              {temporaryMatches[material.id] && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMatch([material.id], null);
                                  }}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                          ) : autoSuggestedMatches[material.id] ? (
                            <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-yellow-500/10 rounded-md">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate text-yellow-700">
                                    Suggested:{" "}
                                    {autoSuggestedMatches[material.id].name}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="text-yellow-600 border-yellow-400"
                                  >
                                    Auto
                                  </Badge>
                                </div>
                                <p className="text-sm text-yellow-600">
                                  Click to review and confirm this suggestion
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMatch(
                                    [material.id],
                                    autoSuggestedMatches[material.id].kbobId
                                  );
                                }}
                              >
                                Accept
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-2 p-2 bg-yellow-500/10 text-yellow-600 rounded-md text-sm">
                              Click to match with KBOB material
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - KBOB Materials */}
            <div className="flex flex-col border rounded-lg overflow-hidden h-full">
              <div className="p-4 border-b bg-secondary/10 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span>KBOB Materials Database</span>
                    <Badge variant="outline">
                      {kbobMaterials.length} materials
                    </Badge>
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="auto-scroll"
                      className="text-sm text-muted-foreground"
                    >
                      Auto-scroll
                    </Label>
                    <Switch
                      id="auto-scroll"
                      checked={autoScrollEnabled}
                      onCheckedChange={setAutoScrollEnabled}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {activeSearchId
                    ? "Select a KBOB material to match with your highlighted Ifc material"
                    : "First select an Ifc material on the left to match it"}
                </p>
                <div className="flex items-center gap-2">
                  <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search KBOB materials..."
                    value={kbobSearchTerm}
                    onChange={(e) => setKbobSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
                {kbobSearchTerm.length >= 2 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {getSuggestions(kbobSearchTerm).map(
                      ({ type, text, id }) => (
                        <Badge
                          key={`${type}-${text}`}
                          variant="secondary"
                          className={`cursor-pointer hover:bg-secondary/20 ${
                            !activeSearchId ? "opacity-50" : ""
                          }`}
                          onClick={() => {
                            if (id && activeSearchId) {
                              handleBulkMatch(id);
                              setActiveSearchId(null);
                            } else {
                              setKbobSearchTerm(text);
                            }
                          }}
                        >
                          {type === "favorite" && (
                            <StarFilledIcon className="w-3 h-3 text-yellow-400 mr-1" />
                          )}
                          {type === "phrase" && (
                            <MagnifyingGlassIcon className="w-3 h-3 text-muted-foreground mr-1" />
                          )}
                          {text}
                        </Badge>
                      )
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0" ref={kbobListRef}>
                <div className="divide-y">
                  {sortedKbobMaterials
                    .filter((material) => {
                      if (!material.Name) return false;
                      return normalizeText(material.Name).includes(
                        normalizeText(kbobSearchTerm)
                      );
                    })
                    .map((material) => (
                      <div
                        key={material._id}
                        data-kbob-id={material._id}
                        className={`p-4 transition-colors ${
                          selectedMaterials.length > 0
                            ? "hover:bg-primary/5 cursor-pointer"
                            : "opacity-75"
                        }`}
                        onClick={() => {
                          if (selectedMaterials.length > 0) {
                            handleBulkMatch(material._id);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">
                                {material.Name}
                              </h3>
                              <button
                                className="p-1 hover:bg-secondary/20 rounded shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(material._id);
                                }}
                              >
                                {favoriteMaterials.includes(material._id) ? (
                                  <StarFilledIcon className="w-4 h-4 text-yellow-400" />
                                ) : (
                                  <StarIcon className="w-4 h-4 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                            <div className="mt-1 space-y-1">
                              <p className="text-sm text-muted-foreground">
                                GWP: {material.GWP} kg CO₂-eq
                              </p>
                              <p className="text-sm text-muted-foreground">
                                UBP: {material.UBP}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                PENRE: {material.PENRE}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      {showPreview && (
        <MaterialChangesPreviewModal
          changes={previewChanges}
          isOpen={showPreview}
          onClose={handleCancelMatch}
          onConfirm={handleConfirmMatch}
          onNavigateToProject={handleNavigateToProject}
          isLoading={isMatchingInProgress}
        />
      )}
      {/* Add the warning dialog */}
      <AlertDialog open={showLeaveWarning} onOpenChange={setShowLeaveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to leave?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You have {Object.keys(temporaryMatches).length} material matches
                that haven't been applied yet. These changes will be lost if you
                leave without confirming them.
              </p>
              <p>
                You can review and apply your changes now, or leave without
                saving.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel
              onClick={() => {
                setShowLeaveWarning(false);
                setPendingNavigation(null);
              }}
            >
              Stay
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleShowPreviewFromWarning}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Review Changes
            </Button>
            <AlertDialogAction
              onClick={handleConfirmNavigation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
