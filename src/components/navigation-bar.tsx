"use client";

import * as React from "react";
import {
  Bell,
  HelpCircle,
  Menu,
  Search,
  PlusCircle,
  Database,
  FileText,
  BarChart,
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

export function NavigationBar({ currentProject, notifications }: NavBarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6">
        <div className="mr-4 hidden md:flex">
          <Link className="mr-6 flex items-center space-x-2" href="/">
            <div className="overflow-hidden">
              <Image
                src="/logo.png"
                alt="IfcLCA Logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg"
              />
            </div>
            <span className="hidden font-bold sm:inline-block">IfcLCA</span>
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
                          <div className="text-sm font-medium leading-none">
                            All Projects
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            View and manage all your LCA projects.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects?filter=active"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Active Projects
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            View and manage your ongoing LCA projects.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects?filter=completed"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Completed Projects
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Access your finished LCA projects and reports.
                          </p>
                        </Link>
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
                          href="/materials/new"
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <Database className="h-6 w-6 mb-2" />
                          <div className="mb-2 text-lg font-medium">
                            Create New Material
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Add a new material to your LCA database.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/materials-library"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Material Library
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Browse and manage your material database.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/custom-materials"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Custom Materials
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Create and manage custom material entries.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/material-reports"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Material Reports
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Generate reports on material usage and impact.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Reports</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports"
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <FileText className="h-6 w-6 mb-2" />
                          <div className="mb-2 mt-4 text-lg font-medium">
                            LCA Reports
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Comprehensive Life Cycle Assessment reports for your
                            projects.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports/carbon-footprint"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Carbon Footprint
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Analyze and report on project carbon emissions.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports/material-impact"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Material Impact
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Detailed reports on material environmental impact.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports/comparison"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Comparison
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Compare LCA results across multiple projects or
                            scenarios.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
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
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Input
              className="hidden md:flex"
              placeholder="Search projects..."
              type="search"
            />
          </div>
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">Help</span>
            </Button>

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
    </nav>
  );
}
