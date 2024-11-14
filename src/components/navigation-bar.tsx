"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  Bell,
  HelpCircle,
  Menu,
  Search,
  PlusCircle,
  Database,
  FileText,
  BarChart,
  Moon,
  Sun,
  ExternalLink,
  Construction,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { HelpDialog } from "@/components/help-dialog";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { UploadModal } from "@/components/upload-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Project {
  id: string;
  name: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

interface NavBarProps {
  currentProject?: Project;
  notifications: Notification[];
}

interface SearchResult {
  _id: string;
  name: string;
  description?: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  isExpanded: boolean;
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onMouseEnter: (index: number) => void;
  onShowMore: () => void;
}

function SearchResults({
  results,
  isExpanded,
  selectedIndex,
  onSelect,
  onMouseEnter,
  onShowMore,
}: SearchResultsProps) {
  const displayResults = isExpanded ? results : results.slice(0, 5);
  const hasMore = !isExpanded && results.length > 5;

  return (
    <div className="space-y-1">
      {displayResults.map((result, index) => (
        <Button
          key={result._id}
          variant="ghost"
          className={cn(
            "w-full justify-start text-left",
            index === selectedIndex && "bg-accent"
          )}
          onClick={() => onSelect(result)}
          onMouseEnter={() => onMouseEnter(index)}
        >
          <div>
            <div className="font-medium">{result.name}</div>
            {result.description && (
              <div className="text-xs text-muted-foreground line-clamp-1">
                {result.description}
              </div>
            )}
          </div>
        </Button>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          className="w-full justify-center text-sm text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShowMore();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          Show all {results.length} results
        </Button>
      )}
    </div>
  );
}

export function NavigationBar({ currentProject, notifications }: NavBarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme, setTheme } = useTheme();
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const searchProjects = async () => {
      if (isFocused && !debouncedSearch) {
        setIsSearching(true);
        try {
          const response = await fetch("/api/projects/search?all=true");
          const data = await response.json();
          setSearchResults(data);
        } catch (error) {
          console.error("Failed to fetch projects:", error);
        } finally {
          setIsSearching(false);
        }
        return;
      }

      if (!debouncedSearch) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/projects/search?q=${debouncedSearch}`
        );
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Failed to search projects:", error);
      } finally {
        setIsSearching(false);
      }
    };

    searchProjects();
  }, [debouncedSearch, isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          const selected = searchResults[selectedIndex];
          router.push(`/projects/${selected._id}`);
          setSearchQuery("");
          setSearchResults([]);
          setSelectedIndex(-1);
        }
        break;
      case "Escape":
        setSearchQuery("");
        setSearchResults([]);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchResults]);

  const handleSelect = (result: SearchResult) => {
    router.push(`/projects/${result._id}`);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedIndex(-1);
    setIsExpanded(false);
  };

  const handleShowMore = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setIsExpanded(true);
  };

  const handleAnalyseClick = async () => {
    try {
      const response = await fetch("/api/projects");
      const projects = await response.json();

      if (!projects?.length) {
        return;
      }
      setProjects(projects);
      setShowProjectSelect(true);
    } catch (error) {
      console.error("Failed to check projects:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6">
        <div className="mr-4 hidden md:flex">
          <Link className="mr-16 flex items-center space-x-2" href="/">
            <div className="overflow-hidden">
              <Image
                src="/logo.png"
                alt="IfcLCA Logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg"
              />
            </div>
            <div className="flex items-center">
              <span className="hidden font-bold sm:inline-block relative">
                IfcLCA
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-8 text-[10px] px-1 py-0 h-4"
                >
                  BETA
                </Badge>
              </span>
            </div>
          </Link>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Projects</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects/new"
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <PlusCircle className="h-6 w-6 mb-2" />
                          <div className="mb-2 text-lg font-medium">
                            Create New Project
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Start a new LCA analysis for your building project.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none flex items-center gap-2">
                            All Projects
                            <Construction className="h-3 w-3" />
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            View and manage all your LCA projects.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <button
                          onClick={handleAnalyseClick}
                          className="w-full block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none flex items-center gap-2">
                            Analyse IFC
                            <FileText className="h-3 w-3" />
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground text-left">
                            Add construction elements from IFC to an existing
                            project
                          </p>
                        </button>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Materials</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <Link
                          href="/materials-library"
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <Database className="h-6 w-6 mb-2" />
                          <div className="mb-2 text-lg font-medium">
                            Match Materials
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Match your project materials with KBOB environmental
                            indicators.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <a
                          href="https://www.lcadata.ch"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none flex items-center gap-2">
                            KBOB Data
                            <ExternalLink className="h-3 w-3" />
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Access KBOB environmental data through our API
                            interface
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <a
                          href="https://www.kbob.admin.ch/de/oekobilanzdaten-im-baubereich"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none flex items-center gap-2">
                            Official KBOB Website
                            <ExternalLink className="h-3 w-3" />
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Visit the official KBOB environmental data portal
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>
                  Reports
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    Coming Soon
                  </Badge>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="flex flex-col gap-4 p-6 w-[400px]">
                    <div className="text-center space-y-2">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                      <h3 className="font-medium text-lg">Reports</h3>
                      <p className="text-sm text-muted-foreground">
                        We're working on comprehensive LCA reporting features.
                        Stay tuned for detailed environmental impact analysis,
                        material assessments, and project comparisons.
                      </p>
                    </div>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <NavigationMenu className="flex flex-col gap-4">
              <NavigationMenuList className="flex-col items-start gap-4">
                {/* Mobile menu content (similar to desktop, but adapted for mobile) */}
                {/* ... */}
              </NavigationMenuList>
            </NavigationMenu>
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="relative w-full flex-1 md:w-auto md:flex-none">
            <Input
              className="hidden md:flex"
              placeholder="Search projects..."
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                const isShowMoreButton = (
                  e.relatedTarget as HTMLElement
                )?.classList.contains("show-more-button");
                if (!isShowMoreButton) {
                  setTimeout(() => {
                    setIsFocused(false);
                    setSelectedIndex(-1);
                  }, 200);
                }
              }}
            />

            {(searchResults.length > 0 || isSearching) &&
              (isFocused || searchQuery) && (
                <Card className="absolute top-full mt-2 w-full z-50">
                  <CardContent className="p-2">
                    {isSearching ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <SearchResults
                        results={searchResults}
                        isExpanded={isExpanded}
                        selectedIndex={selectedIndex}
                        onSelect={handleSelect}
                        onMouseEnter={setSelectedIndex}
                        onShowMore={handleShowMore}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
          </div>
          <nav className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="h-8 w-8"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <HelpDialog />

            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8",
                    userButtonPopover: "w-48",
                  },
                  layout: {
                    shimmer: true,
                  },
                }}
              />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="outline" size="sm">
                  Sign in
                </Button>
              </SignInButton>
            </SignedOut>
          </nav>
        </div>
      </div>
      <Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose a project to upload the IFC file to
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {projects.map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setShowProjectSelect(false);
                }}
              >
                {project.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedProjectId && (
        <UploadModal
          projectId={selectedProjectId}
          open={true}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setSelectedProjectId(null);
            }
          }}
          onSuccess={(upload: { id: string }) => {
            setSelectedProjectId(null);
            router.push(`/projects/${selectedProjectId}`);
          }}
          onProgress={(progress: number) => {
            console.log("Upload progress:", progress);
          }}
        />
      )}
    </nav>
  );
}
