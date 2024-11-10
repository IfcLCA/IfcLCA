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
  Building2,
  ArrowRight,
  BarChart3,
  Leaf,
  Users,
  Sun,
  Moon,
  Menu,
  Upload,
  Code,
} from "lucide-react";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    console.log("Login attempted with:", email, password);
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
      <div className="fixed inset-0 transition-colors duration-500 bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 -z-10"></div>
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-gray-900/40 to-gray-900/80 animate-pulse"></div>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-green-500/10 animate-float"
            style={{
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 10 + 10}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          ></div>
        ))}
      </div>

      <header className="p-4 flex justify-between items-center relative z-10">
        <div className="flex items-center space-x-2">
          <Building2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          <span className="text-2xl font-bold text-gray-800 dark:text-white">
            IfcLCA 2.0
          </span>
        </div>
        <nav className="hidden md:flex items-center space-x-4">
          <Link
            href="#features"
            className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
          >
            Features
          </Link>
          <Link
            href="#about"
            className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
          >
            About
          </Link>
          <Link
            href="#login"
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
              href="#features"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              onClick={toggleMenu}
            >
              Features
            </Link>
            <Link
              href="#about"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              onClick={toggleMenu}
            >
              About
            </Link>
            <Link
              href="#login"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              onClick={toggleMenu}
            >
              Login
            </Link>
          </nav>
        </div>
      )}

      <main className="flex-grow relative z-10">
        <section className="py-12 px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-4">
            Open Source Life Cycle Assessment for the Built Environment
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            IfcLCA 2.0 empowers architects, engineers, and sustainability
            experts to make data-driven decisions for greener, more efficient
            structures across the entire built environment.
          </p>
          <Button
            size="lg"
            asChild
            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          >
            <a href="#login">
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
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
              },
              {
                icon: Upload,
                title: "IFC Integration",
                description:
                  "Deep IFC integration with custom parser for accurate material and quantity analysis.",
              },
              {
                icon: BarChart3,
                title: "Environmental Impact Data",
                description:
                  "Utilizes Swiss KBOB data for precise environmental impact assessment.",
              },
              {
                icon: Leaf,
                title: "No Data Storage",
                description:
                  "We don't save your IFC files, ensuring data privacy and security.",
              },
              {
                icon: Users,
                title: "Collaboration",
                description:
                  "Foster teamwork and knowledge sharing in sustainable design and analysis.",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-green-600 dark:text-green-400 mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="about" className="py-12 px-4">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                About IfcLCA 2.0
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                IfcLCA 2.0 is the next generation of open-source Life Cycle
                Assessment tools for the entire built environment. By leveraging
                Industry Foundation Classes (IFC) and advanced analytics, we
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
                To get started, simply upload any IFC file with BaseQuantities.
                Our custom IFC parser will analyze the file, extracting
                materials and quantities along with metadata, without storing
                any of your sensitive data.
              </p>
            </div>
            <div className="md:w-1/2">
              <Image
                src="/placeholder.svg?height=300&width=400"
                alt="IfcLCA 2.0 Dashboard Preview"
                width={400}
                height={300}
                className="rounded-lg shadow-lg transition-all duration-300 hover:scale-105"
              />
            </div>
          </div>
        </section>

        <section
          id="login"
          className="py-12 px-4 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm"
        >
          <div className="max-w-md mx-auto">
            <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Access IfcLCA 2.0</CardTitle>
                <CardDescription>
                  Log in or create an account to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                      >
                        Log in <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="register">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Create an account to start your journey with IfcLCA 2.0.
                      Unlock powerful tools for sustainable building design and
                      analysis.
                    </p>
                    <Button className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                      Create Account <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Link
                  href="#"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Forgot password?
                </Link>
                <Link
                  href="#"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Need help?
                </Link>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>

      <footer className="bg-gray-100/80 dark:bg-gray-900/50 backdrop-blur-sm py-8 px-4 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Building2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            <span className="text-xl font-bold text-gray-800 dark:text-white">
              IfcLCA 2.0
            </span>
          </div>
          <nav className="flex flex-wrap justify-center gap-4 mb-4 md:mb-0">
            <Link
              href="#"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              GitHub
            </Link>
            <Link
              href="#"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              Documentation
            </Link>
            <Link
              href="#"
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              Contact
            </Link>
          </nav>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            &copy; {new Date().getFullYear()} IfcLCA 2.0. Open Source Software.
          </div>
        </div>
      </footer>
    </div>
  );
}
