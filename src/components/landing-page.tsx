"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

// Floating shapes component
const FloatingShapes = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-orange-400/10 to-blue-400/10 dark:from-orange-500/20 dark:to-blue-500/20 blur-3xl"
          animate={{
            x: [0, 100, -100, 0],
            y: [0, -100, 100, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{
            duration: 20 + i * 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 2,
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

// Feature card with magnetic hover effect
const FeatureCard = ({ feature, index }: { feature: any; index: number }) => {
  const [isHovered, setIsHovered] = useState(false);
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
      rotateX.set(-y * 5); // Subtle 3D tilt
      rotateY.set(x * 5);
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
          }}
          className="h-full"
        >
          <Card className="h-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden relative">
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
              <Button variant="ghost" className="group-hover:text-orange-600 dark:group-hover:text-orange-400">
                Learn more <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

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
      title: "Real-Time Analysis",
      description: "Instant feedback and analysis results for quick decision-making in your design process.",
      color: "from-yellow-500 to-orange-500",
    },
  ];

  const stats = [
    { value: 95, suffix: "%", label: "Accuracy Rate" },
    { value: 50, suffix: "+", label: "Data Sources" },
    { value: 24, suffix: "/7", label: "Analysis Time" },
    { value: 100, suffix: "%", label: "Open Source" },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Architect",
      company: "EcoDesign Studios",
      quote: "IfcLCA has revolutionized our approach to sustainable building design. The real-time analysis saves us hours of work.",
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
        <section ref={heroRef} className="py-16 px-4 text-center relative overflow-hidden">
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
              Life Cycle Assessment for the{" "}
              <span className="bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
                Built Environment
              </span>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              IfcLCA empowers architects, engineers, and sustainability experts to
              make data-driven decisions for environmentally optimized structures
              across the AEC industry using IFC models and Swiss KBOB environmental data.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link href="/sign-in?redirect_url=/">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 dark:from-orange-500 dark:to-orange-400 dark:hover:from-orange-600 dark:hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 px-8"
                  >
                    Start Your Analysis <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="https://github.com/IfcLCA/IfcLCA" target="_blank" rel="noopener noreferrer">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Code className="mr-2 h-5 w-5" /> View on GitHub
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>

          {/* Animated background elements */}
          <motion.div
            className="absolute -top-40 -right-40 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              rotate: [360, 180, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </section>

        {/* Stats Section */}
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

        {/* Features Section */}
        <section
          id="features"
          className="py-16 px-4 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm"
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
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 px-4">
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
                  description: "Our AI analyzes materials and quantities instantly",
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
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 3, repeat: Infinity }}
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

        {/* Testimonials Section */}
        <section className="py-16 px-4 bg-gradient-to-r from-orange-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
                Trusted by Industry Leaders
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                See what professionals are saying about IfcLCA
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5 }}
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonials[activeTestimonial].rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 italic">
                  "{testimonials[activeTestimonial].quote}"
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-purple-400 rounded-full mr-4" />
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white">
                      {testimonials[activeTestimonial].name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {testimonials[activeTestimonial].role} at {testimonials[activeTestimonial].company}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center mt-6 gap-2">
              {testimonials.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${index === activeTestimonial
                    ? "w-8 bg-orange-600 dark:bg-orange-400"
                    : "bg-gray-400 dark:bg-gray-600"
                    }`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>
          </motion.div>
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
                  Sustainable Future
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
                      { icon: Globe, text: "Global Standards" },
                      { icon: Shield, text: "Data Privacy" },
                      { icon: RotateCcw, text: "Continuous Updates" },
                      { icon: Award, text: "Industry Recognition" },
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
                      Learn More About Our Technology
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
                    className="absolute -inset-4 bg-gradient-to-r from-orange-400 to-purple-400 rounded-2xl opacity-20 blur-2xl -z-10"
                    animate={{
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </motion.div>
                <motion.div
                  className="absolute -top-6 -right-6 bg-orange-100 dark:bg-orange-900/30 rounded-xl p-4 shadow-lg"
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <CheckCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </motion.div>
                <motion.div
                  className="absolute -bottom-6 -left-6 bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 shadow-lg"
                  animate={{
                    y: [0, 10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.5,
                  }}
                >
                  <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-gradient-to-r from-orange-600 to-purple-600 rounded-3xl p-12 text-center text-white relative overflow-hidden">
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
              <div className="relative z-10">
                <h2 className="text-4xl font-bold mb-4">
                  Ready to Transform Your Building Analysis?
                </h2>
                <p className="text-xl mb-8 opacity-90">
                  Join thousands of professionals using IfcLCA for sustainable design
                </p>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block"
                >
                  <Link href="/sign-in?redirect_url=/">
                    <Button
                      size="lg"
                      className="bg-white text-orange-600 hover:bg-gray-100 shadow-xl px-8 py-6 text-lg"
                    >
                      Start Free Analysis
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100/80 dark:bg-gray-900/50 backdrop-blur-sm py-12 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Image
                  src="/logo.png"
                  alt="IfcLCA Logo"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg"
                />
                <span className="text-xl font-bold text-gray-800 dark:text-white">
                  IfcLCA
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Open-source Life Cycle Assessment for sustainable building design
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white mb-4">Product</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/features" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/documentation" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="https://github.com/IfcLCA/IfcLCA" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
                    GitHub
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="https://www.gnu.org/licenses/agpl-3.0.en.html" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
                    AGPL-3.0 License
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              &copy; {new Date().getFullYear()} IfcLCA. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <Link href="https://www.lt.plus" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                Built by LT+
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
