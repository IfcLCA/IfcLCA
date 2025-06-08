"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import NavigationHeader from "@/components/navigation-header";
import {
    Code,
    Upload,
    Database,
    Shield,
    Users,
    Zap,
    BarChart3,
    FileCode,
    TreePine,
    Lock,
    Building2,
    Download,
    Globe,
    Brain,
    Cpu,
    CheckCircle,
    ArrowRight,
    Sparkles,
    TrendingUp,
    RotateCcw,
    GitBranch,
    Star,
    Clock,
    HardDrive,
    Cloud,
    FileText,
    PieChart,
    LineChart,
    Activity,
    Package,
    Layers,
    Search
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import MarketingFooter from "@/components/marketing-footer";

export default function FeaturesPage() {
    const [activeFeature, setActiveFeature] = useState(0);

    const mainFeatures = [
        {
            title: "Open Source Architecture",
            subtitle: "Transparent, Community-Driven Development",
            icon: Code,
            color: "from-blue-500 to-cyan-500",
            description: "Built on trust and transparency with AGPL-3.0 license",
            details: [
                {
                    title: "Full Code Transparency",
                    description: "Every line of code is open for inspection, modification, and contribution",
                    icon: GitBranch
                },
                {
                    title: "Community Collaboration",
                    description: "Join developers worldwide in improving environmental analysis tools",
                    icon: Users
                },
                {
                    title: "No Vendor Lock-in",
                    description: "Fork, modify, or self-host - you have complete control",
                    icon: Shield
                }
            ],
            stats: [
                { label: "GitHub Stars", value: "22", icon: Star },
                { label: "Contributors", value: "2+", icon: Users },
                { label: "License", value: "AGPL-3.0", icon: Shield }
            ]
        },
        {
            title: "Advanced IFC Processing",
            subtitle: "IfcOpenShell WASM Technology",
            icon: FileCode,
            color: "from-purple-500 to-pink-500",
            description: "Industry-leading IFC parsing directly in your browser",
            details: [
                {
                    title: "WebAssembly Performance",
                    description: "Native speed processing without server uploads using IfcOpenShell compiled to WASM",
                    icon: Cpu
                },
                {
                    title: "Comprehensive Data Extraction",
                    description: "Extract BaseQuantities, material layers, and constituents with precise calculations",
                    icon: Database
                },
                {
                    title: "IFC2x3 & IFC4 Support",
                    description: "Compatible with all modern IFC schema versions",
                    icon: FileCode
                }
            ],
            stats: [
                { label: "Parse Time", value: "~30s", icon: Clock },
                { label: "Max File Size", value: "100MB", icon: HardDrive },
                { label: "Elements", value: "10k+", icon: Package }
            ]
        },
        {
            title: "Swiss KBOB Database",
            subtitle: "Professional Environmental Data",
            icon: TreePine,
            color: "from-green-500 to-emerald-500",
            description: "Access to 300+ materials with certified environmental impacts",
            details: [
                {
                    title: "Certified Data Source",
                    description: "Official Swiss KBOB environmental database from lcadata.ch",
                    icon: CheckCircle
                },
                {
                    title: "Multiple Indicators",
                    description: "Calculate GWP, PEnr, and UBP for comprehensive analysis",
                    icon: BarChart3
                },
                {
                    title: "Smart Matching",
                    description: "Fuzzy string matching automatically links your materials to the database",
                    icon: Brain
                }
            ],
            stats: [
                { label: "Materials", value: "300+", icon: Layers },
                { label: "Indicators", value: "3", icon: Activity },
                { label: "Updates", value: "Regular", icon: RotateCcw }
            ]
        },
        {
            title: "Privacy-First Design",
            subtitle: "Your Data Stays Yours",
            icon: Shield,
            color: "from-orange-500 to-red-500",
            description: "Complete client-side processing with zero data storage",
            details: [
                {
                    title: "Browser-Based Processing",
                    description: "All calculations happen locally - your files never leave your computer",
                    icon: Lock
                },
                {
                    title: "No Cloud Storage",
                    description: "We don't store, log, or have access to your building models",
                    icon: Cloud
                },
                {
                    title: "Instant Cleanup",
                    description: "All temporary data is cleared from memory after processing",
                    icon: RotateCcw
                }
            ],
            stats: [
                { label: "Files Stored", value: "0", icon: HardDrive },
                { label: "Data Logged", value: "None", icon: FileText },
                { label: "Privacy", value: "100%", icon: Shield }
            ]
        },
        {
            title: "Project Management",
            subtitle: "Organize Your Analyses",
            icon: Building2,
            color: "from-indigo-500 to-purple-500",
            description: "Manage multiple building projects with ease",
            details: [
                {
                    title: "Project Dashboard",
                    description: "Track all your analyses in one centralized location",
                    icon: Building2
                },
                {
                    title: "Personal Libraries",
                    description: "Save and reuse custom material mappings across projects",
                    icon: Database
                },
                {
                    title: "Unlimited Uploads",
                    description: "Upload and analyze multiple IFC files per project without restrictions",
                    icon: Upload
                }
            ],
            stats: [
                { label: "Free Projects per User", value: "3", icon: Building2 },
                { label: "Uploads", value: "∞", icon: Upload },
                { label: "Storage", value: "Unlimited", icon: HardDrive }
            ]
        },
        {
            title: "Visualize Results",
            subtitle: "Export & Share Outcomes",
            icon: Download,
            color: "from-yellow-500 to-orange-500",
            description: "Generate nice charts for your projects",
            details: [
                {
                    title: "Interactive Graphs",
                    description: "Dynamic visualizations with material breakdowns and comparisons",
                    icon: BarChart3
                },
                {
                    title: "Export Options",
                    description: "PDF reports, CSV data tables, and detailed summaries",
                    icon: Download
                },
                {
                    title: "Element-Level Detail",
                    description: "Drill down to individual building elements with full material traceability",
                    icon: Search
                }
            ],
            stats: [
                { label: "Chart Types", value: "5+", icon: PieChart },
                { label: "Export Formats", value: "3", icon: FileText },
                { label: "Data Points", value: "All", icon: Database }
            ]
        }
    ];

    const technicalFeatures = [
        {
            category: "IFC Processing",
            features: [
                "IfcOpenShell WASM engine for browser-based processing",
                "Support for IFC2x3 and IFC4 schemas",
                "Automatic extraction of BaseQuantities",
                "Material layer and constituent set parsing",
                "Geometric data visualization",
                "Element type classification"
            ]
        },
        {
            category: "Environmental Analysis",
            features: [
                "GWP (Global Warming Potential) in kg CO₂-eq",
                "PEnr (Primary Energy non-renewable) in MJ-eq",
                "UBP (Environmental Impact Points)",
                "Material-based impact calculations",
                "Element-wise breakdown analysis",
                "Comparative scenario modeling"
            ]
        },
        {
            category: "Data Management",
            features: [
                "Project-based organization",
                "Custom material libraries",
                "Mapping history tracking",
                "Bulk material operations",
                "Search and filter capabilities",
                "Data export and import"
            ]
        },
        {
            category: "Visualization",
            features: [
                "Interactive treemap charts",
                "Material breakdown pie charts",
                "Impact comparison bar charts",
                "Time-series analysis",
                "3D model preview (coming soon)",
                "Custom color schemes"
            ]
        }
    ];

    const comparisonData = [
        {
            feature: "Processing Location",
            ifclca: "Client-side (Browser)",
            others: "Server-side (Cloud)",
            advantage: "Privacy & Speed"
        },
        {
            feature: "Data Storage",
            ifclca: "None - Zero storage",
            others: "Cloud storage required",
            advantage: "Complete Privacy"
        },
        {
            feature: "Environmental Database",
            ifclca: "Swiss KBOB (300+ materials)",
            others: "Varies or proprietary",
            advantage: "Certified Data"
        },
        {
            feature: "Licensing",
            ifclca: "Open Source (AGPL-3.0)",
            others: "Proprietary/Commercial",
            advantage: "Free Forever"
        },
        {
            feature: "IFC Support",
            ifclca: "IFC2x3, IFC4",
            others: "Limited versions",
            advantage: "Wide Compatibility"
        },
        {
            feature: "Cost",
            ifclca: "Free",
            others: "$99-999/month",
            advantage: "No Subscription"
        }
    ];

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
                            <Sparkles className="w-4 h-4" />
                            Comprehensive Feature Set
                        </motion.div>

                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                            Everything You Need for LCA
                        </h1>
                        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                            Professional environmental analysis tools designed for the modern AEC industry
                        </p>

                        <div className="flex flex-wrap gap-4 justify-center">
                            <Link href="/sign-in?redirect_url=/">
                                <Button size="lg" className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg">
                                    Start Free <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link href="/documentation">
                                <Button size="lg" variant="outline">
                                    View Documentation
                                </Button>
                            </Link>
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

            {/* Main Features Grid */}
            <section className="container mx-auto px-4 py-16">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl font-bold mb-4">Core Features</h2>
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                        Professional tools that set IfcLCA apart
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {mainFeatures.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            viewport={{ once: true }}
                        >
                            <Card className="h-full hover:shadow-2xl transition-all duration-300 overflow-hidden group flex flex-col">
                                <CardHeader>
                                    <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${feature.color} mb-4`}>
                                        <feature.icon className="h-8 w-8 text-white" />
                                    </div>
                                    <CardTitle className="text-2xl mb-2">{feature.title}</CardTitle>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                        {feature.subtitle}
                                    </p>
                                </CardHeader>
                                <CardContent className="flex flex-col flex-grow">
                                    <div className="flex-grow">
                                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                                            {feature.description}
                                        </p>

                                        <div className="space-y-4 mb-6">
                                            {feature.details.map((detail, i) => (
                                                <div key={i} className="flex gap-3">
                                                    <div className="flex-shrink-0">
                                                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                                                            <detail.icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-sm mb-1">{detail.title}</h4>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            {detail.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
                                        {feature.stats.map((stat, i) => (
                                            <div key={i} className="text-center">
                                                <div className="flex items-center justify-center gap-1 mb-1">
                                                    <stat.icon className="h-3 w-3 text-gray-400" />
                                                    <div className="text-lg font-bold">{stat.value}</div>
                                                </div>
                                                <div className="text-xs text-gray-500">{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Technical Features */}
            <section className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm py-16">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12">Technical Capabilities</h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                        {technicalFeatures.map((category, index) => (
                            <motion.div
                                key={category.category}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                            >
                                <Card className="h-full flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{category.category}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ul className="space-y-2">
                                            {category.features.map((feature, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                    <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Table */}
            <section className="container mx-auto px-4 py-16">
                <h2 className="text-3xl font-bold text-center mb-12">Why Choose IfcLCA?</h2>

                <Card className="max-w-4xl mx-auto overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left p-4 font-medium">Feature</th>
                                        <th className="text-center p-4 font-medium text-orange-600 dark:text-orange-400">
                                            IfcLCA
                                        </th>
                                        <th className="text-center p-4 font-medium text-gray-600 dark:text-gray-400">
                                            Other Tools
                                        </th>
                                        <th className="text-center p-4 font-medium">Advantage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonData.map((row, index) => (
                                        <motion.tr
                                            key={row.feature}
                                            initial={{ opacity: 0, x: -20 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            viewport={{ once: true }}
                                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                        >
                                            <td className="p-4 font-medium">{row.feature}</td>
                                            <td className="p-4 text-center">
                                                <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    {row.ifclca}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-center text-gray-600 dark:text-gray-400">
                                                {row.others}
                                            </td>
                                            <td className="p-4 text-center">
                                                <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400">
                                                    {row.advantage}
                                                </Badge>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Use Cases */}
            <section className="bg-gray-50 dark:bg-gray-900 py-16">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12">Perfect For</h2>

                    <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        <Card className="text-center hover:shadow-lg transition-shadow">
                            <CardContent className="p-8">
                                <Building2 className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                                <h3 className="text-xl font-semibold mb-2">Architects</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Make data-driven design decisions with instant environmental feedback
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="text-center hover:shadow-lg transition-shadow">
                            <CardContent className="p-8">
                                <TreePine className="h-16 w-16 mx-auto mb-4 text-green-500" />
                                <h3 className="text-xl font-semibold mb-2">Sustainability Engineers</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Perform comprehensive LCA with certified environmental data
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="text-center hover:shadow-lg transition-shadow">
                            <CardContent className="p-8">
                                <BarChart3 className="h-16 w-16 mx-auto mb-4 text-purple-500" />
                                <h3 className="text-xl font-semibold mb-2">Project Managers</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Track and report environmental impacts across all projects
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="container mx-auto px-4 py-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="text-center max-w-2xl mx-auto"
                >
                    <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                        Join the growing community using IfcLCA for sustainable building design
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/sign-in?redirect_url=/">
                            <Button size="lg" className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg">
                                Create Free Account
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Link href="https://github.com/IfcLCA/IfcLCA" target="_blank">
                            <Button size="lg" variant="outline">
                                <Code className="mr-2 h-5 w-5" />
                                View on GitHub
                            </Button>
                        </Link>
                    </div>

                    <p className="mt-8 text-sm text-gray-600 dark:text-gray-400">
                        No credit card required • 3 free projects • Unlimited uploads
                    </p>
                </motion.div>
        <MarketingFooter />
            </section>
        </div>
    );
} 