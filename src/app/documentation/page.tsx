"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import NavigationHeader from "@/components/navigation-header";
import MarketingFooter from "@/components/marketing-footer";
import {
  FileText,
  Upload,
  Database,
  BarChart3,
  Download,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Code,
  Zap,
  Shield,
  BookOpen,
  Video,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Terminal,
  FileCode,
  Globe,
  Users
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState("getting-started");

  const quickLinks = [
    {
      title: "Getting Started",
      description: "Learn the basics of IfcLCA in 5 minutes",
      icon: Zap,
      tabValue: "getting-started",
      color: "from-orange-500 to-red-500"
    },
    {
      title: "IFC Requirements",
      description: "Prepare your BIM models for analysis",
      icon: FileCode,
      tabValue: "ifc-guide",
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "Material Mapping",
      description: "Connect your materials to KBOB database",
      icon: Database,
      tabValue: "features",
      color: "from-green-500 to-emerald-500"
    },
    {
      title: "Troubleshooting",
      description: "Common issues and solutions",
      icon: Code,
      tabValue: "troubleshooting",
      color: "from-purple-500 to-pink-500"
    }
  ];

  const gettingStartedSteps = [
    {
      number: "01",
      title: "Create Your Account",
      description: "Sign up using email or social login through our secure Clerk authentication",
      icon: Users,
      details: [
        "Email verification required",
        "OAuth support (Google, GitHub)",
        "Secure password requirements",
        "Account recovery options"
      ]
    },
    {
      number: "02",
      title: "Create a Project",
      description: "Organize your work with project-based analysis",
      icon: FileText,
      details: [
        "Descriptive project naming",
        "Project metadata (location, type)",
        "Up to 3 free projects per account",
        "Unlimited file uploads per project"
      ]
    },
    {
      number: "03",
      title: "Upload IFC File",
      description: "Import your BIM model with material and quantity data",
      icon: Upload,
      details: [
        "IFC2x3 and IFC4 supported",
        "Files up to 100MB",
        "Must include BaseQuantities",
        "Material definitions required"
      ]
    },
    {
      number: "04",
      title: "Map Materials",
      description: "Connect IFC materials to environmental impact data",
      icon: Database,
      details: [
        "300+ KBOB materials available",
        "Fuzzy string matching",
        "Manual override options",
        "Save custom mappings"
      ]
    },
    {
      number: "05",
      title: "Analyze Results",
      description: "View comprehensive environmental impact analysis",
      icon: BarChart3,
      details: [
        "GWP (Global Warming Potential)",
        "PEnr (Primary Energy non-renewable)",
        "UBP (Environmental Impact Points)",
        "Material breakdown charts"
      ]
    },
    {
      number: "06",
      title: "Export Reports",
      description: "Generate professional documentation",
      icon: Download,
      details: [
        "PDF chart exports",
        "CSV data tables",
        "Material lists",
        "Element summaries"
      ]
    }
  ];

  const ifcRequirements = {
    essential: [
      {
        requirement: "BaseQuantities",
        description: "Your IFC file must include IfcElementQuantity with BaseQuantities for accurate volume calculations",
        status: "required"
      },
      {
        requirement: "Material Definitions",
        description: "Materials must be defined using IfcMaterial, IfcMaterialLayerSet, or IfcMaterialConstituentSet",
        status: "required"
      },
      {
        requirement: "File Version",
        description: "Support for IFC2x3 and IFC4 schemas",
        status: "required"
      }
    ],
    recommended: [
      {
        requirement: "Consistent Naming",
        description: "Use clear, consistent material names for better automatic matching",
        status: "recommended"
      },
      {
        requirement: "Element Classification",
        description: "Proper IFC element types improve analysis accuracy",
        status: "recommended"
      },
      {
        requirement: "Geometric Representation",
        description: "Include geometric data for visual verification",
        status: "recommended"
      }
    ],
    exportSettings: {
      revit: [
        "Enable 'Export Base Quantities'",
        "Include 'Material Information'",
        "Use IFC4 Reference View",
        "Export only necessary elements"
      ],
      archicad: [
        "Use 'IFC Translator' with quantities",
        "Enable 'Base Quantities' in translator",
        "Include material definitions",
        "Check geometry conversion"
      ],
      other: [
        "Verify BaseQuantities export",
        "Test with small model first",
        "Validate IFC schema",
        "Check material assignments"
      ]
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-20 dark:opacity-40" />
        <div className="container mx-auto px-4 py-16 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-700 dark:text-orange-300 text-sm font-medium mb-6"
            >
              <BookOpen className="w-4 h-4" />
              Complete Documentation
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Know
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              From quick start to advanced features, master IfcLCA for professional environmental analysis
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="https://github.com/IfcLCA/IfcLCA" target="_blank">
                <Button variant="outline" className="gap-2">
                  <Code className="h-4 w-4" />
                  View Source Code
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
              <Button variant="outline" className="gap-2" disabled>
                <Video className="h-4 w-4" />
                Watch Tutorial (Coming Soon)
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Background decoration */}
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
      </section>

      {/* Quick Links */}
      <section className="container mx-auto px-4 -mt-8 mb-16 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickLinks.map((link, index) => (
            <motion.div
              key={link.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                onClick={() => setActiveSection(link.tabValue)}
                className="h-full hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${link.color} mb-4`}>
                    <link.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {link.description}
                  </p>
                  <ArrowRight className="h-4 w-4 mt-3 text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Main Documentation Content */}
      <section className="container mx-auto px-4 pb-16">
        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-8">
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full max-w-3xl mx-auto">
            <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
            <TabsTrigger value="ifc-guide">IFC Guide</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
          </TabsList>

          {/* Getting Started Tab */}
          <TabsContent value="getting-started" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Quick Start Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {gettingStartedSteps.map((step, index) => (
                    <motion.div
                      key={step.number}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-6"
                    >
                      <div className="flex-shrink-0">
                        <div className="text-4xl font-bold text-orange-200 dark:text-orange-900">
                          {step.number}
                        </div>
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                            <step.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold mb-1">{step.title}</h3>
                            <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
                          </div>
                        </div>
                        <ul className="ml-11 space-y-2">
                          {step.details.map((detail, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    Pro Tip
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Start with a small section of your building model to test the workflow before uploading large files.
                    This helps you verify that materials and quantities are correctly exported.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IFC Guide Tab */}
          <TabsContent value="ifc-guide" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">IFC File Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Essential Requirements
                  </h3>
                  <div className="space-y-3">
                    {ifcRequirements.essential.map((req, index) => (
                      <div key={index} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <h4 className="font-medium mb-1">{req.requirement}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{req.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Recommended Practices
                  </h3>
                  <div className="space-y-3">
                    {ifcRequirements.recommended.map((req, index) => (
                      <div key={index} className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <h4 className="font-medium mb-1">{req.requirement}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{req.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Export Settings by Software</h3>
                  <Tabs defaultValue="revit" className="w-full">
                    <TabsList className="grid grid-cols-3 w-full">
                      <TabsTrigger value="revit">Revit</TabsTrigger>
                      <TabsTrigger value="archicad">ArchiCAD</TabsTrigger>
                      <TabsTrigger value="other">Other</TabsTrigger>
                    </TabsList>
                    {Object.entries(ifcRequirements.exportSettings).map(([software, settings]) => (
                      <TabsContent key={software} value={software} className="mt-4">
                        <ul className="space-y-2">
                          {settings.map((setting, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 text-gray-400 mt-0.5" />
                              <span className="text-sm">{setting}</span>
                            </li>
                          ))}
                        </ul>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>


              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-8">
            <div className="grid gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Material Mapping System</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Database className="h-5 w-5 text-blue-500" />
                        KBOB Database Integration
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 300+ construction materials</li>
                        <li>• Swiss environmental data standards</li>
                        <li>• Regular updates from lcadata.ch</li>
                        <li>• Multiple impact indicators per material</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-orange-500" />
                        Smart Matching Algorithm
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• Fuzzy string matching for material names</li>
                        <li>• Confidence scoring system</li>
                        <li>• Manual override capabilities</li>
                        <li>• Custom material library support</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Environmental Indicators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">GWP</div>
                      <div className="font-medium mb-1">Global Warming Potential</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">kg CO₂-eq</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">PEnr</div>
                      <div className="font-medium mb-1">None-Renewable Primary Energy</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">kWh Oil-eq</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">UBP</div>
                      <div className="font-medium mb-1">Points</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Swiss Environmental Impact Points</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Analysis & Export Options</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-green-500" />
                        Interactive Charts
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• Material breakdown by impact</li>
                        <li>• Element type comparisons</li>
                        <li>• Treemap visualizations</li>
                        <li>• Customizable chart types</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Download className="h-5 w-5 text-purple-500" />
                        Export Formats
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• PDF reports with charts</li>
                        <li>• CSV data tables</li>
                        <li>• Material mapping lists</li>
                        <li>• Element summaries</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Troubleshooting Tab */}
          <TabsContent value="troubleshooting" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Common Issues & Solutions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20">
                    <h4 className="font-semibold mb-2">No materials found in IFC file</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      This usually happens when materials aren&apos;t properly exported from your BIM software.
                    </p>
                    <ul className="text-sm space-y-1">
                      <li>✓ Check export settings include materials</li>
                      <li>✓ Verify IfcMaterial entities exist in file</li>
                      <li>✓ Ensure materials are assigned to elements</li>
                    </ul>
                  </div>

                  <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                    <h4 className="font-semibold mb-2">Missing quantities or zero volumes</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      BaseQuantities must be exported for accurate calculations.
                    </p>
                    <ul className="text-sm space-y-1">
                      <li>✓ Enable &quot;Export Base Quantities&quot; in BIM software</li>
                      <li>✓ Check IfcElementQuantity entities</li>
                      <li>✓ Verify NetVolume or GrossVolume properties</li>
                    </ul>
                  </div>

                  <div className="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
                    <h4 className="font-semibold mb-2">Materials not matching KBOB database</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      The fuzzy matching algorithm needs recognizable material names.
                    </p>
                    <ul className="text-sm space-y-1">
                      <li>✓ Use standard material names (e.g., &quot;Concrete C30/37&quot;)</li>
                      <li>✓ Avoid project-specific codes in names</li>
                      <li>✓ Manually map unmatched materials</li>
                    </ul>
                  </div>

                  <div className="p-4 border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                    <h4 className="font-semibold mb-2">Large file processing issues</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Files over 50MB may take longer to process.
                    </p>
                    <ul className="text-sm space-y-1">
                      <li>✓ Processing happens in your browser</li>
                      <li>✓ Allow up to 30 seconds for analysis</li>
                      <li>✓ Consider splitting very large models</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Need More Help?
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>• Check our <Link href="https://github.com/IfcLCA/IfcLCA/issues" className="text-orange-600 dark:text-orange-400 hover:underline">GitHub Issues</Link> for known problems</p>
                    <p>• Join the discussion in <Link href="https://github.com/IfcLCA/IfcLCA/discussions" className="text-orange-600 dark:text-orange-400 hover:underline">GitHub Discussions</Link></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Resources Section */}
      <section className="bg-gray-50 dark:bg-gray-900 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Additional Resources</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <Globe className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                <h3 className="font-semibold mb-2">lcadata.ch</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  KBOB API as data source
                </p>
                <Link href="https://www.lcadata.ch" target="_blank">
                  <Button variant="outline" size="sm" className="gap-2">
                    Visit Site <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <FileCode className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="font-semibold mb-2">IFC Documentation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  BuildingSMART IFC specifications
                </p>
                <Link href="https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/" target="_blank">
                  <Button variant="outline" size="sm" className="gap-2">
                    Learn More <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-purple-500" />
                <h3 className="font-semibold mb-2">Privacy Policy</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  How we protect your data
                </p>
                <Link href="/privacy">
                  <Button variant="outline" size="sm" className="gap-2">
                    Read Policy <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
