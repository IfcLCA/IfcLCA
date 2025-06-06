"use client";

import { motion } from "framer-motion";
import NavigationHeader from "@/components/navigation-header";
import {
    GitBranch,
    Heart,
    Shield,
    Eye,
    Users,
    TreePine,
    Sparkles,
    Code,
    Globe,
    Handshake
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OpenSourcePhilosophyPage() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6
            }
        }
    };

    const values = [
        {
            icon: Heart,
            title: "Passion for Progress",
            description: "I believe open source software drives our industry forward, enabling collective innovation that no single entity could achieve alone."
        },
        {
            icon: Shield,
            title: "AGPL-3.0 by Choice",
            description: "I release nearly all my software under AGPL. Because I can. And because I believe it creates the strongest foundation for collaborative development."
        },
        {
            icon: Eye,
            title: "Transparency Builds Trust",
            description: "From personal experience, I've learned that openness and transparency are the cornerstones of trust-especially crucial in sustainability work."
        },
        {
            icon: Users,
            title: "Community First",
            description: "Open source isn't just about code; it's about building a community where everyone can contribute, learn, and benefit together."
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            <NavigationHeader />

            {/* Hero Section */}
            <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="relative py-20 px-4 overflow-hidden"
            >
                {/* Background decoration */}
                <div className="absolute inset-0">
                    <motion.div
                        className="absolute top-20 -left-20 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl"
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
                        className="absolute bottom-20 -right-20 w-96 h-96 bg-green-400/10 rounded-full blur-3xl"
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
                </div>

                <div className="max-w-4xl mx-auto relative z-10">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-700 dark:text-orange-300 text-sm font-medium mb-6"
                    >
                        <GitBranch className="w-4 h-4" />
                        Open Source Philosophy
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6"
                    >
                        Why I Choose{" "}
                        <span className="bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
                            Open Source
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl"
                    >
                        A personal statement from Louis Trümpler, creator and maintainer of IfcLCA
                    </motion.p>
                </div>
            </motion.section>

            {/* Main Content */}
            <section className="py-16 px-4">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="max-w-4xl mx-auto"
                >
                    {/* Introduction */}
                    <motion.div
                        variants={itemVariants}
                        className="prose prose-lg dark:prose-invert max-w-none mb-16"
                    >
                        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                            I'm Louis Trümpler, and I've made a conscious choice to release all my software under the
                            AGPL-3.0 license. This isn't just a legal decision-it's a reflection of my deeply held
                            beliefs about how we can advance as an industry and build a more sustainable future together.
                        </p>
                    </motion.div>

                    {/* Core Values Grid */}
                    <motion.div
                        variants={itemVariants}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16"
                    >
                        {values.map((value, index) => (
                            <motion.div
                                key={index}
                                whileHover={{ scale: 1.02 }}
                                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-gradient-to-r from-orange-500 to-green-500 rounded-xl">
                                        <value.icon className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                        {value.title}
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300">
                                    {value.description}
                                </p>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Philosophy Section */}
                    <motion.div
                        variants={itemVariants}
                        className="bg-gradient-to-r from-orange-50 to-green-50 dark:from-gray-800/50 dark:to-gray-700/50 p-12 rounded-3xl mb-16"
                    >
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <TreePine className="h-8 w-8 text-green-600" />
                            Sustainability Through Transparency
                        </h2>
                        <div className="space-y-4 text-gray-700 dark:text-gray-300">
                            <p>
                                In the field of sustainability, trust is not just important-it's essential. When we're
                                making decisions that affect our planet's future, stakeholders need to know exactly how
                                environmental impact calculations are performed, what assumptions are made, and where the
                                data comes from.
                            </p>
                            <p>
                                My personal experience has shown me that this trust comes from openness and transparency.
                                By making IfcLCA's source code completely open, we ensure that every calculation, every
                                algorithm, and every data transformation can be inspected, verified, and improved by the
                                community.
                            </p>
                            <p>
                                This isn't just about code-it's about building a movement where sustainability professionals
                                can collaborate openly, share knowledge freely, and accelerate our collective progress toward
                                a more sustainable built environment.
                            </p>
                        </div>
                    </motion.div>

                    {/* Why AGPL Section */}
                    <motion.div
                        variants={itemVariants}
                        className="mb-16"
                    >
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                            <Shield className="h-8 w-8 text-orange-600" />
                            Why AGPL-3.0?
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                <Code className="h-10 w-10 text-orange-500 mb-4" />
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    Forever Free
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    AGPL ensures that IfcLCA and all its derivatives remain free and open source forever,
                                    preventing proprietary lock-in.
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                <Globe className="h-10 w-10 text-green-500 mb-4" />
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    Network Protection
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Even when used as a web service, modifications must be shared with users, ensuring
                                    transparency in all deployments.
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                <Handshake className="h-10 w-10 text-blue-500 mb-4" />
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    Community Benefit
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    All improvements benefit everyone. Companies can use and modify IfcLCA, but must
                                    contribute their enhancements back.
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Call to Action */}
                    <motion.div
                        variants={itemVariants}
                        className="text-center bg-gray-100 dark:bg-gray-800 p-12 rounded-3xl"
                    >
                        <Sparkles className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                            Join the Movement
                        </h2>
                        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                            Whether you're a developer, sustainability professional, or simply someone who believes
                            in open collaboration, there's a place for you in the IfcLCA community.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link href="https://github.com/IfcLCA/IfcLCA" target="_blank">
                                <Button size="lg" className="gap-2">
                                    <GitBranch className="h-5 w-5" />
                                    View on GitHub
                                </Button>
                            </Link>
                            <Link href="/documentation">
                                <Button size="lg" variant="outline" className="gap-2">
                                    <Code className="h-5 w-5" />
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    </motion.div>

                    {/* Quote */}
                    <motion.div
                        variants={itemVariants}
                        className="mt-16 text-center"
                    >
                        <blockquote className="text-2xl font-medium text-gray-700 dark:text-gray-300 italic">
                            "I release software under AGPL simply because I can, and because I believe it's the
                            right thing to do for our industry and our planet."
                        </blockquote>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">
                            - Louis Trümpler, Creator of IfcLCA
                        </p>
                    </motion.div>
                </motion.div>
            </section>
        </div>
    );
} 