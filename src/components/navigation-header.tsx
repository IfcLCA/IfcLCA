"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Sun, Moon, Zap } from "lucide-react";

export default function NavigationHeader() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const root = document.documentElement;
        const initialDarkMode = root.classList.contains("dark");
        setIsDarkMode(initialDarkMode);
    }, []);

    const toggleDarkMode = () => {
        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.remove("dark");
        } else {
            root.classList.add("dark");
        }
        setIsDarkMode(!isDarkMode);
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const isActive = (path: string) => {
        return pathname === path;
    };

    const getLinkClasses = (path: string, isHighlighted: boolean = false) => {
        const isCurrentPage = isActive(path);

        if (isHighlighted) {
            // Try Now link styling
            return `px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${isCurrentPage
                    ? "text-orange-700 dark:text-orange-300"
                    : "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                }`;
        }

        // Regular link styling
        return `px-4 py-2 text-sm transition-colors ${isCurrentPage
                ? "text-gray-900 font-medium dark:text-white"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            }`;
    };

    return (
        <>
            <motion.header
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 100 }}
                className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 z-50"
            >
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Link href="/" className="flex items-center space-x-2">
                            <motion.div
                                whileHover={{ rotate: 360 }}
                                transition={{ duration: 0.6 }}
                                className="relative w-10 h-10"
                            >
                                <Image
                                    src="/logo.png"
                                    alt="IfcLCA Logo"
                                    width={40}
                                    height={40}
                                    className="rounded-lg"
                                />
                            </motion.div>
                            <span className="text-xl font-bold text-gray-800 dark:text-white">
                                IfcLCA
                            </span>
                        </Link>
                    </motion.div>
                    <nav className="hidden md:flex items-center space-x-4">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link
                                href="/try"
                                className={getLinkClasses("/try", true)}
                            >
                                <Zap className="h-3.5 w-3.5" />
                                Try Now
                            </Link>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link
                                href="/features"
                                className={getLinkClasses("/features")}
                            >
                                Features
                            </Link>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link
                                href="/documentation"
                                className={getLinkClasses("/documentation")}
                            >
                                Documentation
                            </Link>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link
                                href="/sign-in?redirect_url=/"
                                className={getLinkClasses("/sign-in")}
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
                </div>
            </motion.header>

            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 fixed top-16 right-0 left-0 z-40 shadow-lg"
                    >
                        <nav className="flex flex-col space-y-4">
                            <Link
                                href="/try"
                                className={`${getLinkClasses("/try", true)} ${isActive("/try") ? "bg-orange-50 dark:bg-orange-900/20 rounded-lg px-4 py-2" : ""
                                    }`}
                                onClick={toggleMenu}
                            >
                                <Zap className="h-3.5 w-3.5" />
                                Try Now
                            </Link>
                            <Link
                                href="/features"
                                className={`${getLinkClasses("/features")} ${isActive("/features") ? "bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2" : ""
                                    }`}
                                onClick={toggleMenu}
                            >
                                Features
                            </Link>
                            <Link
                                href="/documentation"
                                className={`${getLinkClasses("/documentation")} ${isActive("/documentation") ? "bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2" : ""
                                    }`}
                                onClick={toggleMenu}
                            >
                                Documentation
                            </Link>
                            <Link
                                href="/sign-in?redirect_url=/"
                                className={getLinkClasses("/sign-in")}
                                onClick={toggleMenu}
                            >
                                Login
                            </Link>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
} 