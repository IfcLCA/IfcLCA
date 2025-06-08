"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { useInView } from "react-intersection-observer";
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
import { useRouter } from "next/navigation";
import { fileTransferService } from "@/lib/file-transfer";
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
  Star,
  Shield,
  Award,
  CheckCircle,
  TrendingUp,
  Globe,
  Sparkles,
  Building2,
  TreePine,
  RotateCcw,
  X,
  GitBranch,
  Database,
  FileCode,
  Lock,
  Cpu,
  BarChart,
  BookOpen,
  Heart,
  Flag,
  ArrowDown,
  GitFork,
} from "lucide-react";
import MarketingFooter from "@/components/marketing-footer";

// Floating shapes component
const FloatingShapes = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-orange-400/5 to-blue-400/5 dark:from-orange-500/10 dark:to-blue-500/10 blur-3xl"
          animate={{
            x: [0, 50, -50, 0],
            y: [0, -30, 30, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{
            duration: 30 + i * 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 3,
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  );
};

// Animated counter component
const AnimatedCounter = ({ end, duration = 2, suffix = "" }: { end: number; duration?: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });

  useEffect(() => {
    if (inView) {
      let start = 0;
      const increment = end / (duration * 60);
      const timer = setInterval(() => {
        start += increment;
        if (start > end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 1000 / 60);
      return () => clearInterval(timer);
    }
  }, [inView, end, duration]);

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  );
};

// Feature Modal Component
const FeatureModal = ({ feature, isOpen, onClose, githubMetrics = { stars: 0, contributors: 0, commits: 0 } }: { feature: any; isOpen: boolean; onClose: () => void; githubMetrics?: { stars: number; contributors: number; commits: number } }) => {
  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !feature) return null;

  const getFeatureDetails = (title: string) => {
    switch (title) {
      case "Open Source":
        return {
          icon: GitBranch,
          subtitle: "AGPL-3.0 Licensed • Community Driven",
          content: [
            {
              title: "Complete Transparency",
              description: "Every line of code is open for inspection. Built on trust and transparency, IfcLCA ensures you know exactly how your environmental data is calculated.",
              icon: Code,
            },
            {
              title: "Creator's Philosophy",
              description: "Louis Trümpler releases IfcLCA under AGPL because he believes it drives our industry forward. Trust is essential for sustainability, and trust comes from openness.",
              icon: Heart,
            },
            {
              title: "Forever Free",
              description: "Licensed under AGPL-3.0, IfcLCA will always remain free and open. No vendor lock-in, no hidden costs, just sustainable software for sustainable buildings.",
              icon: Shield,
            },
          ],
          stats: [
            { label: "GitHub Stars", value: githubMetrics.stars > 0 ? githubMetrics.stars.toString() : "0" },
            { label: "Contributors", value: githubMetrics.contributors > 0 ? githubMetrics.contributors.toString() : "0" },
            { label: "Commits", value: githubMetrics.commits > 0 ? githubMetrics.commits.toString() : "0" },
          ],
          cta: {
            text: "Read Open Source Philosophy",
            href: "/open-source-philosophy",
          },
        };

      case "IFC Integration":
        return {
          icon: FileCode,
          subtitle: "IfcOpenShell WASM • IFC2x3 & IFC4 Support",
          content: [
            {
              title: "Advanced IFC Parser",
              description: "Powered by IfcOpenShell compiled to WebAssembly, our parser runs directly in your browser for maximum speed and privacy.",
              icon: Cpu,
            },
            {
              title: "Comprehensive Data Extraction",
              description: "Automatically extracts BaseQuantities, material layers (IfcMaterialLayerSet), and material constituents (IfcMaterialConstituentSet) with precise volume calculations.",
              icon: Database,
            },
            {
              title: "Smart Material Recognition",
              description: "Intelligent parsing identifies materials from complex IFC structures, supporting nested assemblies and composite elements.",
              icon: Sparkles,
            },
          ],
          stats: [
            { label: "large IFC files", value: "100 MB+" },
            { label: "Parse Speed", value: "<1min" },
            { label: "IFC Coverage", value: "100%" },
          ],
          cta: {
            text: "See Documentation",
            href: "/documentation",
          },
        };

      case "Environmental Impact Data":
        return {
          icon: TreePine,
          subtitle: "Swiss KBOB Database • lcadata.ch Integration",
          content: [
            {
              title: "Swiss KBOB Standards",
              description: "Access the comprehensive Swiss KBOB environmental database with over 300+ material categories and precise impact factors from lcadata.ch.",
              icon: Database,
            },
            {
              title: "Multiple Indicators",
              description: "Calculate Global Warming Potential (GWP), Primary Energy non-renewable (PEnr), and Environmental Impact Points (UBP) for complete analysis.",
              icon: BarChart,
            },
            {
              title: "Smart Material Matching",
              description: "Fuzzy string matching automatically links your IFC material names to KBOB database entries, ensuring accurate environmental assessments.",
              icon: Zap,
            },
          ],
          stats: [
            { label: "Materials", value: "300+" },
            { label: "Indicators", value: "3" },
            { label: "Data Source", value: "lcadata.ch" },
          ],
          cta: {
            text: "Visit lcadata.ch",
            href: "https://www.lcadata.ch",
          },
        };

      case "No Data Storage":
        return {
          icon: Lock,
          subtitle: "Client-Side Processing • Zero Storage",
          content: [
            {
              title: "Local Processing",
              description: "Your IFC files are processed entirely in your browser using WebAssembly. No file uploads to servers means zero data exposure.",
              icon: Shield,
            },
            {
              title: "Complete Privacy",
              description: "We never store, log, or have access to your building models. Your intellectual property remains yours alone.",
              icon: Lock,
            },
            {
              title: "Instant Deletion",
              description: "All temporary data is immediately cleared from browser memory after processing. No traces left behind.",
              icon: RotateCcw,
            },
          ],
          stats: [
            { label: "Files Stored", value: "0" },
            { label: "Data Logged", value: "None" },
            { label: "Privacy", value: "100%" },
          ],
          cta: {
            text: "Read Privacy Policy",
            href: "/privacy",
          },
        };

      case "Collaboration":
        return {
          icon: Users,
          subtitle: "Team Projects • Shared Libraries",
          content: [
            {
              title: "Project Dashboard",
              description: "Manage multiple building projects in one place. Track progress, compare alternatives, and monitor environmental improvements.",
              icon: Building2,
            },
            {
              title: "Personal Material Libraries",
              description: "Build and maintain your own material database. Save custom materials with specific environmental data for reuse across projects.",
              icon: Database,
            },
            {
              title: "Team Workflows (Coming Soon)",
              description: "Soon you'll be able to invite team members, assign roles, and collaborate on sustainable design decisions with shared projects.",
              icon: Users,
            },
          ],
          stats: [
            { label: "Uploads", value: "∞" },
            { label: "Projects per User", value: "currently 3" },
            { label: "Material Mappings", value: "∞" },
          ],
          cta: {
            text: "Start Your Projects",
            href: "/sign-in?redirect_url=/",
          },
        };

      case "Fast Browser Analysis":
        return {
          icon: Zap,
          subtitle: "Browser-Based Processing • WebAssembly Performance",
          content: [
            {
              title: "Client-Side Processing",
              description: "WASM-powered processing runs entirely in your browser. Analyze IFC files without uploading to servers, ensuring data privacy.",
              icon: Zap,
            },
            {
              title: "Comprehensive Analysis",
              description: "Process complex IFC models with thousands of elements. Get detailed environmental impact calculations for every component.",
              icon: TrendingUp,
            },
            {
              title: "Interactive Results",
              description: "Explore your results with dynamic visualizations. Identify impact hotspots, analyze by material type, and export detailed reports.",
              icon: BarChart3,
            },
          ],
          stats: [
            { label: "Analysis Time", value: "~30s" },
            { label: "Browser Support", value: "99%" },
            { label: "No Upload", value: "0 MB" },
          ],
          cta: {
            text: "Try It Now",
            href: "/try",
          },
        };

      default:
        return null;
    }
  };

  const details = getFeatureDetails(feature.title);
  if (!details) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative p-8 pb-0">
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </motion.button>

                <div className="flex items-center gap-4 mb-4">
                  <motion.div
                    className={`p-4 rounded-xl bg-gradient-to-r ${feature.color}`}
                    animate={{
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <details.icon className="h-8 w-8 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {details.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 pt-6 overflow-y-auto max-h-[60vh]">
                {/* Feature Details */}
                <div className="space-y-6 mb-8">
                  {details.content.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-4"
                    >
                      <div className="flex-shrink-0">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                          <item.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {item.title}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                          {item.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {details.stats.map((stat, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {stat.label}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex justify-center"
                >
                  <Link href={details.cta.href} target={details.cta.href.startsWith('http') ? '_blank' : undefined}>
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white"
                      onClick={onClose}
                    >
                      {details.cta.text}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Feature card with magnetic hover effect
const FeatureCard = ({ feature, index, githubMetrics = { stars: 0, contributors: 0, commits: 0 } }: { feature: any; index: number; githubMetrics?: { stars: number; contributors: number; commits: number } }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Create motion values for smooth animation
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring animation for smooth movement
  const springConfig = { stiffness: 400, damping: 30 };
  const iconX = useSpring(mouseX, springConfig);
  const iconY = useSpring(mouseY, springConfig);

  // For subtle 3D tilt
  const rotateX = useSpring(0, { stiffness: 300, damping: 30 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height;

    if (isHovered) {
      mouseX.set(x * 20);
      mouseY.set(y * 20);
      rotateX.set(-y * 3); // Reduced 3D tilt for Firefox compatibility
      rotateY.set(x * 3);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.6 }}
        viewport={{ once: true }}
      >
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          whileHover={{ y: -8 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="h-full relative"
          onClick={() => setModalOpen(true)}
          style={{
            transformStyle: "preserve-3d",
            perspective: "1000px",
          }}
        >
          <motion.div
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
              pointerEvents: "none", // Prevent this layer from interfering with clicks
            }}
            className="h-full"
          >
            <Card
              className="h-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden relative"
              style={{ pointerEvents: "auto" }} // Re-enable pointer events for the card
            >
              {/* Morphing border effect */}
              <motion.div
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{
                  background: `linear-gradient(45deg, transparent 30%, ${feature.color.split(' ')[1]} 50%, transparent 70%)`,
                  opacity: 0,
                }}
                animate={{
                  opacity: isHovered ? [0, 0.3, 0] : 0,
                  backgroundPosition: isHovered ? ["0% 0%", "100% 100%", "0% 0%"] : "0% 0%",
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />

              <CardHeader>
                <motion.div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} mb-4 relative`}
                  style={{
                    x: iconX,
                    y: iconY,
                    transformStyle: "preserve-3d",
                    transform: "translateZ(20px)",
                  }}
                >
                  {/* Liquid morphing background */}
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    animate={{
                      background: isHovered
                        ? [
                          `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 70%)`,
                          `radial-gradient(circle at 70% 70%, rgba(255,255,255,0.3) 0%, transparent 70%)`,
                          `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 70%)`,
                        ]
                        : `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)`,
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Ambient glow effect */}
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    animate={{
                      opacity: isHovered ? [0.5, 0.8, 0.5] : 0,
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{
                      background: `radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, transparent 60%)`,
                      filter: "blur(8px)",
                    }}
                  />

                  <feature.icon className="h-6 w-6 text-white relative z-10" />

                  {/* Particle effects */}
                  {isHovered && [...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-white rounded-full"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                        x: [0, (Math.random() - 0.5) * 30],
                        y: [0, (Math.random() - 0.5) * 30],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.2,
                        repeat: Infinity,
                        repeatDelay: 0.5,
                      }}
                      style={{
                        left: "50%",
                        top: "50%",
                      }}
                    />
                  ))}
                </motion.div>

                {/* Subtle background pattern on hover */}
                <motion.div
                  className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
                  style={{
                    backgroundImage: `radial-gradient(circle at center, ${feature.color.split(' ')[1]} 1px, transparent 1px)`,
                    backgroundSize: "10px 10px",
                  }}
                />

                <CardTitle className="text-xl font-semibold group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors relative z-10">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </CardContent>
              <CardFooter className="relative z-10">
                <Button
                  variant="ghost"
                  className="group-hover:text-orange-600 dark:group-hover:text-orange-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalOpen(true);
                  }}
                >
                  Learn more <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      <FeatureModal
        feature={feature}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        githubMetrics={githubMetrics}
      />
    </>
  );
};

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [githubMetrics, setGithubMetrics] = useState({
    stars: 0,
    contributors: 0,
    commits: 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const router = useRouter();

  // Headline carousel state
  const [currentHeadlineIndex, setCurrentHeadlineIndex] = useState(0);
  const headlines = [
    {
      prefix: "Life Cycle Assessment for the",
      highlight: "Built Environment"
    },
    {
      prefix: "Environmental Analysis for",
      highlight: "IFC Building Models"
    },
    {
      prefix: "Carbon Footprint Analysis for",
      highlight: "Infrastructure Projects"
    },
    {
      prefix: "Sustainability Metrics for",
      highlight: "BIM Models"
    },
    {
      prefix: "Instant LCA Reports for",
      highlight: "Construction Projects"
    }
  ];

  // Rotate headlines
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeadlineIndex((prev) => (prev + 1) % headlines.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch GitHub metrics
    const fetchGithubMetrics = async () => {
      try {
        const response = await fetch('/api/stats/github-stars');
        if (response.ok) {
          const data = await response.json();
          setGithubMetrics({
            stars: data.stars || 0,
            contributors: data.contributors || 0,
            commits: data.commits || 0
          });
        }
      } catch (error) {
        console.log('Failed to fetch GitHub metrics:', error);
        setGithubMetrics({
          stars: 0,
          contributors: 0,
          commits: 0
        }); // Fallback
      }
    };

    fetchGithubMetrics();
  }, []);



  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const features = [
    {
      icon: Code,
      title: "Open Source",
      description: "Fully open-source solution allowing for collaborative and transparent approach to LCA.",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Upload,
      title: "IFC Integration",
      description: "Deep IFC integration with custom parser for accurate material and quantity analysis.",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: BarChart3,
      title: "Environmental Impact Data",
      description: "Utilizes Swiss KBOB data for precise environmental impact assessment.",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: Shield,
      title: "No Data Storage",
      description: "We don't save your IFC files, ensuring data privacy and security.",
      color: "from-orange-500 to-red-500",
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Foster teamwork and knowledge sharing in sustainable design and analysis.",
      color: "from-indigo-500 to-purple-500",
    },
    {
      icon: Zap,
      title: "Fast Browser Analysis",
      description: "Complete environmental analysis in ~30 seconds, all processed locally in your browser.",
      color: "from-yellow-500 to-orange-500",
    },
  ];

  const stats = [
    { value: 300, suffix: "+", label: "Materials" },
    { value: githubMetrics.stars, suffix: "", label: "GitHub Stars" },
    { value: 3, suffix: "", label: "Free Projects per User" },
    { value: 100, suffix: "%", label: "Open Source" },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Architect",
      company: "EcoDesign Studios",
      quote: "IfcLCA has revolutionized our approach to sustainable building design. The fast browser-based analysis saves us hours of work.",
      rating: 5,
    },
    {
      name: "Michael Torres",
      role: "Sustainability Engineer",
      company: "GreenBuild Corp",
      quote: "The accuracy of environmental impact data using Swiss KBOB standards is unmatched. Essential tool for any serious LCA professional.",
      rating: 5,
    },
    {
      name: "Dr. Emma Wilson",
      role: "Research Director",
      company: "Institute for Sustainable Construction",
      quote: "Finally, an open-source LCA tool that delivers professional-grade results without compromising on features or accuracy.",
      rating: 5,
    },
  ];

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
      // Pass the actual file to the service
      fileTransferService.setPendingFile(file);
      router.push('/try');
    }
  }, [router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.ifc')) {
      // Pass the actual file to the service
      fileTransferService.setPendingFile(file);
      router.push('/try');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? "dark" : ""}`}>
      <div className="fixed inset-0 transition-colors duration-500 bg-gradient-to-br from-orange-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 -z-10">
        <div className="absolute inset-0 bg-grid-pattern opacity-20 dark:opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-orange-500/10 to-transparent dark:via-orange-500/20 animate-gradient" />
        <FloatingShapes />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="p-4 flex justify-between items-center relative z-10 backdrop-blur-sm"
      >
        <motion.div
          className="flex items-center space-x-2"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
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
        </motion.div>
        <nav className="hidden md:flex items-center space-x-4">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/try"
              className="px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
            >
              Try Now
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/features"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              Features
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/documentation"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              Documentation
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/sign-in?redirect_url=/"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              Login
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
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
          </motion.div>
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
      </motion.header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 absolute top-16 right-0 left-0 z-20 shadow-lg"
          >
            <nav className="flex flex-col space-y-4">
              <Link
                href="/features"
                className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                onClick={toggleMenu}
              >
                Features
              </Link>
              <Link
                href="/documentation"
                className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                onClick={toggleMenu}
              >
                Documentation
              </Link>
              <Link
                href="/sign-in?redirect_url=/"
                className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                onClick={toggleMenu}
              >
                Login
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow relative z-10">
        {/* Hero Section */}
        <section ref={heroRef} className="pt-16 pb-12 px-4 text-center relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-700 dark:text-orange-300 text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              Swiss KBOB Data Integration
            </motion.div>

            <motion.h1
              className="text-5xl md:text-7xl font-bold text-gray-800 dark:text-white mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentHeadlineIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  style={{ display: 'block' }}
                >
                  {headlines[currentHeadlineIndex].prefix}{" "}
                  <span className="bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
                    {headlines[currentHeadlineIndex].highlight}
                  </span>
                </motion.span>
              </AnimatePresence>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              Make data-driven decisions for environmentally optimized structures.
              Instant analysis using IFC models and Swiss KBOB environmental data.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link href="/try">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 dark:from-orange-500 dark:to-orange-400 dark:hover:from-orange-600 dark:hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 px-8 py-4 text-lg"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    Try Now - No Account Needed
                  </Button>
                </motion.div>
              </Link>
              <div className="flex gap-3">
                <Link href="/sign-in?redirect_url=/">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Sign In <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/documentation">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <BookOpen className="mr-2 h-4 w-4" /> Docs
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>100% Browser-Based</span>
              </div>
              <div className="flex items-center gap-2">
                <TreePine className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>Swiss KBOB Database</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>IFC 2x3 & 4 Support</span>
              </div>
            </motion.div>

            {/* Directional cue */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: [0, 10, 0] }}
              transition={{ delay: 0.8, duration: 2, repeat: Infinity }}
              className="mt-12"
            >
              <ArrowDown className="h-6 w-6 text-gray-400 mx-auto" />
            </motion.div>
          </motion.div>

          {/* Animated background elements */}
          <motion.div
            className="absolute -top-40 -right-40 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 90, 180],
              x: [0, 30, 0],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.15, 1],
              rotate: [180, 90, 0],
              x: [0, -40, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 35,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Subtle gradient fade at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-gray-900 to-transparent pointer-events-none" />
        </section>

        {/* Try It Now Section - MOVED UP FOR BETTER CONVERSION */}
        <section className="pt-8 pb-16 px-4 relative overflow-hidden bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-800/30 dark:to-gray-900">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto relative z-10"
          >
            <div className="text-center mb-12">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 100 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-700 dark:text-purple-300 text-sm font-medium mb-4"
              >
                <Zap className="w-4 h-4" />
                See It In Action
              </motion.div>
              <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
                Try IfcLCA Right Now
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                No signup. No credit card. Just drag & drop your IFC file below for instant results.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Upload preview */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                viewport={{ once: true }}
              >
                <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <CardContent className="p-8 relative">
                    <motion.div
                      className={`border-2 border-dashed rounded-lg p-12 text-center relative overflow-hidden cursor-pointer transition-all duration-300 ${isDragging
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-gray-300 dark:border-gray-600 hover:border-orange-400"
                        }`}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {/* Animated particles */}
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-2 h-2 bg-orange-400/30 rounded-full"
                          animate={{
                            x: [0, Math.random() * 100 - 50],
                            y: [0, Math.random() * 100 - 50],
                            scale: [0, 1, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            delay: i * 0.5,
                            ease: "easeOut",
                          }}
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                          }}
                        />
                      ))}

                      <motion.div
                        animate={{
                          y: [0, -10, 0],
                          scale: isDragging ? 1.1 : 1,
                          rotate: isDragging ? 5 : 0,
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="inline-flex p-4 rounded-full bg-gradient-to-r from-orange-100 to-purple-100 dark:from-orange-900/30 dark:to-purple-900/30 mb-4"
                      >
                        <Upload className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                      </motion.div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                        Drop your IFC file here
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        100% browser-based • No data stored
                      </p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".ifc"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </motion.div>

                    <Link href="/try">
                      <Button className="w-full mt-6 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white">
                        Or Open Try Page <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Right side - Features */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Zap, label: "~30 seconds", title: "Lightning Fast" },
                    { icon: Shield, label: "100% Private", title: "Browser-Based" },
                    { icon: BarChart3, label: "3 Indicators", title: "Full Analysis" },
                    { icon: TreePine, label: "KBOB Data", title: "Swiss Standards" },
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow">
                        <CardContent className="p-4 text-center">
                          <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex p-2 rounded-lg bg-gradient-to-r from-orange-100 to-purple-100 dark:from-orange-900/30 dark:to-purple-900/30 mb-2"
                          >
                            <item.icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </motion.div>
                          <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                            {item.title}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {item.label}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-white mb-1">
                          What You'll Get Instantly
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          • Interactive charts showing GWP, UBP, and PENRE values<br />
                          • Material-by-material breakdown with environmental impact<br />
                          • Model statistics including element counts and volumes<br />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Stats Section - Social Proof */}
        <motion.section
          className="py-16 px-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <motion.div
                  className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-2"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </motion.div>
                <p className="text-gray-600 dark:text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* How It Works Section */}
        <section className="py-16 px-4 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
                How IfcLCA Works
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Simple steps to sustainable building analysis
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Upload IFC File",
                  description: "Simply upload your IFC file with BaseQuantities",
                  icon: Upload,
                },
                {
                  step: "02",
                  title: "Automatic Analysis",
                  description: "Materials are matched to KBOB database using fuzzy matching",
                  icon: Zap,
                },
                {
                  step: "03",
                  title: "Get Results",
                  description: "Receive comprehensive environmental impact report",
                  icon: BarChart3,
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.2, duration: 0.6 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300"
                  >
                    <motion.div
                      className="text-6xl font-bold text-orange-200 dark:text-orange-900 mb-4"
                      animate={{ opacity: [0.4, 0.5, 0.4] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {item.step}
                    </motion.div>
                    <item.icon className="h-12 w-12 text-orange-600 dark:text-orange-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  </motion.div>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                      <ArrowRight className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-16 px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
              Powerful Features for Sustainable Design
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to perform comprehensive life cycle assessments
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} githubMetrics={githubMetrics} />
            ))}
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-700 dark:text-green-300 text-sm font-medium mb-6">
                  <TreePine className="w-4 h-4" />
                  Optimized Construction
                </div>
                <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-6">
                  Building a Greener Tomorrow
                </h2>
                <div className="space-y-4 text-gray-600 dark:text-gray-300">
                  <p>
                    IfcLCA is the next generation of open-source Life Cycle
                    Assessment tools for the entire built environment. By leveraging
                    Industry Foundation Classes (IFC) and advanced analytics, we
                    provide unparalleled insights into the environmental impact of
                    structures throughout their lifecycle.
                  </p>
                  <p>
                    Our mission is to empower professionals in the AEC industry to
                    create more sustainable, efficient, and environmentally friendly
                    built environments. With our commitment to open-source
                    development, we foster collaboration and transparency in the
                    pursuit of a greener future.
                  </p>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    {[
                      { icon: Flag, text: "Swiss LCA Standards" },
                      { icon: Shield, text: "Data Privacy" },
                      { icon: RotateCcw, text: "Continuous Updates" },
                      { icon: Award, text: "Made by LCA Expert" },
                    ].map((item, index) => (
                      <motion.div
                        key={index}
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm font-medium">{item.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <motion.div
                  className="mt-8"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link href="/documentation">
                    <Button variant="outline" size="lg">
                      Learn More About The Technology
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                viewport={{ once: true }}
                className="relative"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="relative z-10"
                >
                  <Image
                    src={isDarkMode ? "/dashboard-dark.jpeg" : "/dashboard.jpeg"}
                    alt="IfcLCA Dashboard Preview"
                    width={600}
                    height={450}
                    className="rounded-2xl shadow-2xl"
                  />
                  <motion.div
                    className="absolute -inset-4 bg-gradient-to-r from-orange-400 to-purple-400 rounded-2xl opacity-10 blur-2xl -z-10"
                    animate={{
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </motion.div>
                <motion.div
                  className="absolute -top-6 -right-6 bg-orange-100 dark:bg-orange-900/30 rounded-xl p-4 shadow-lg"
                  animate={{
                    y: [0, -5, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <CheckCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </motion.div>
                <motion.div
                  className="absolute -bottom-6 -left-6 bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 shadow-lg"
                  animate={{
                    y: [0, 5, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2,
                  }}
                >
                  <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center relative z-10"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-6">
              Start Your Environmental Analysis Today
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Join leading architects and engineers using IfcLCA to create more sustainable buildings.
              Free to try, powerful when you need it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/try">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg shadow-orange-500/25 px-8 py-4 text-lg"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    Try Now - No Account Needed
                  </Button>
                </motion.div>
              </Link>
              <Link href="/sign-up">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Create Free Account
                  </Button>
                </motion.div>
              </Link>
            </div>
            <motion.p
              className="mt-6 text-sm text-gray-500 dark:text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Shield className="inline-block h-4 w-4 mr-1" />
              100% browser-based • Your data never leaves your device
            </motion.p>
          </motion.div>

          {/* Animated background gradients */}
          <motion.div
            className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-orange-400/10 to-purple-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 60, 120],
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-400/10 to-green-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.15, 1],
              rotate: [120, 60, 0],
            }}
            transition={{
              duration: 35,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </section>
      </main>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
}
