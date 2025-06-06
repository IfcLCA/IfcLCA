"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Leaf,
  Users,
  Sun,
  Moon,
  Menu,
  Upload,
  Code,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<{
    icon: any;
    title: string;
    description: string;
    details: string;
  } | null>(null);

  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? "dark" : ""}`}>
      <div className="fixed inset-0 transition-colors duration-500 bg-gradient-to-br from-orange-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 -z-10">
        <div className="absolute inset-0 bg-grid-pattern opacity-20 dark:opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-orange-500/10 to-transparent dark:via-orange-500/20 animate-gradient" />
      </div>

      <header className="p-4 flex justify-between items-center relative z-10">
        <div className="flex items-center space-x-2">
          <Image
            src="/logo.png"
            alt="IfcLCA Logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
          />
          <span className="text-2xl font-bold text-gray-800 dark:text-white">
            IfcLCA
          </span>
        </div>
        <nav className="hidden md:flex items-center space-x-4">
          <Link
            href="/sign-in?redirect_url=/"
            className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
          >
            Login
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="relative"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle dark mode</span>
          </Button>
        </nav>
        <div className="md:hidden flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="relative mr-2"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle dark mode</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleMenu}>
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </header>

      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 p-4 absolute top-16 right-0 left-0 z-20 shadow-md">
          <nav className="flex flex-col space-y-4">
            <Link
              href="/sign-in?redirect_url=/"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              onClick={toggleMenu}
            >
              Login
            </Link>
          </nav>
        </div>
      )}

      <main className="flex-grow relative z-10">
        <section className="py-12 px-4 text-center" itemScope itemType="https://schema.org/SoftwareApplication">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-4" itemProp="name">
            Life Cycle Assessment for the Built Environment
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto" itemProp="description">
            IfcLCA empowers architects, engineers, and sustainability experts to
            make data-driven decisions for environmentally optimized structures
            across the AEC industry using IFC models and Swiss KBOB environmental data.
          </p>
          <Link href="/sign-in?redirect_url=/">
            <Button
              size="lg"
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>

        <section
          id="features"
          className="py-12 px-4 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm"
        >
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-8">
            Key Features
          </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                {
                  icon: Code,
                  title: "Open Source",
                  description:
                    "Fully open-source solution allowing for collaborative and transparent approach to LCA.",
                  details:
                    "Explore the entire codebase, contribute on GitHub and adapt every part of the workflow to your own needs.",
                },
                {
                  icon: Upload,
                  title: "Ifc Integration",
                  description:
                    "Deep Ifc integration with custom parser for accurate material and quantity analysis.",
                  details:
                    "Upload models with BaseQuantities and let the parser automatically analyse materials and quantities without storing your files.",
                },
                {
                  icon: BarChart3,
                  title: "Environmental Impact Data",
                  description:
                    "Utilizes Swiss KBOB data for precise environmental impact assessment.",
                  details:
                    "Combine your building information with the Swiss KBOB dataset for accurate and localised calculations.",
                },
                {
                  icon: Leaf,
                  title: "No Data Storage",
                  description:
                    "We don't save your Ifc files, ensuring data privacy and security.",
                  details:
                    "Files are processed in-memory only \u2013 nothing is written to disk so your data always stays with you.",
                },
                {
                  icon: Users,
                  title: "Collaboration",
                  description:
                    "Foster teamwork and knowledge sharing in sustainable design and analysis.",
                  details:
                    "Share your results with your team and keep everyone aligned through built\u2011in multi-user access.",
                },
                {
                  icon: Zap,
                  title: "Real-Time Analysis",
                  description:
                    "Instant feedback and analysis results for quick decision-making in your design process.",
                  details:
                    "Get immediate results while you iterate through different design options to find the most sustainable solution.",
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedFeature(feature)}
                  className="cursor-pointer transform transition-all duration-300 hover:scale-105"
                >
                  <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                    <CardHeader>
                      <feature.icon className="h-10 w-10 text-orange-600 dark:text-orange-400 mb-2" />
                      <CardTitle>{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 dark:text-gray-300">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
        </section>

        <section id="about" className="py-12 px-4">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                About IfcLCA
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                IfcLCA is the next generation of open-source Life Cycle
                Assessment tools for the entire built environment. By leveraging
                Industry Foundation Classes (Ifc) and advanced analytics, we
                provide unparalleled insights into the environmental impact of
                structures throughout their lifecycle.
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Our mission is to empower professionals in the AEC industry to
                create more sustainable, efficient, and environmentally friendly
                built environments. With our commitment to open-source
                development, we foster collaboration and transparency in the
                pursuit of a greener future.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                To get started, simply upload any Ifc file with BaseQuantities.
                Our custom Ifc parser will analyze the file, extracting
                materials and quantities along with metadata, without storing
                any of your sensitive data.
              </p>
            </div>
            <div className="md:w-1/2">
              <Image
                src={isDarkMode ? "/dashboard-dark.jpeg" : "/dashboard.jpeg"}
                alt="IfcLCA Dashboard Preview"
                width={400}
                height={300}
                className="rounded-lg shadow-lg transition-all duration-300 hover:scale-105"
              />
            </div>
          </div>
        </section>
        {selectedFeature && (
          <Dialog open={Boolean(selectedFeature)} onOpenChange={(o) => !o && setSelectedFeature(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedFeature.title}</DialogTitle>
                <DialogDescription>
                  {selectedFeature.details}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )}
      </main>

      <footer className="bg-gray-100/80 dark:bg-gray-900/50 backdrop-blur-sm py-8 px-4 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Image
              src="/logo.png"
              alt="IfcLCA Logo"
              width={32}
              height={32}
              className="h-6 w-6 rounded-lg text-green-600 dark:text-green-400"
            />
            <span className="text-xl font-bold text-gray-800 dark:text-white">
              IfcLCA
            </span>
          </div>
          <nav className="flex flex-wrap justify-center gap-4 mb-4 md:mb-0">
            <Link
              href="https://github.com/IfcLCA/IfcLCA"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
            <Link
              href="/documentation"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              Documentation
            </Link>
            <Link
              href="https://www.lt.plus"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contact
            </Link>
          </nav>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            &copy; {new Date().getFullYear()} IfcLCA,{" "}
            <Link
              href="https://www.gnu.org/licenses/agpl-3.0.en.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              AGPL-3.0
            </Link>{" "}
            licensed.
          </div>
        </div>
      </footer>
    </div>
  );
}
