"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star, Shield } from "lucide-react";

export default function MarketingFooter() {
  return (
      <footer className="bg-gray-100/80 dark:bg-gray-900/50 backdrop-blur-sm py-8 px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            {/* Logo and Description - Spans 4 columns */}
            <div className="lg:col-span-4">
              <div className="flex items-center space-x-2 mb-3">
                <Image
                  src="/logo.png"
                  alt="IfcLCA Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg"
                />
                <span className="text-2xl font-bold text-gray-800 dark:text-white">
                  IfcLCA
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                Open-source Life Cycle Assessment for sustainable design and construction.
              </p>
              <div className="mt-4">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-block relative group"
                >
                  {/* Floating hearts on hover - positioned absolutely to parent div */}
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={`heart-hover-${i}`}
                        className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          left: i === 0 ? "-10px" : i === 1 ? "50%" : "auto",
                          right: i === 2 ? "-10px" : "auto",
                          bottom: "-5px",
                          transform: i === 1 ? "translateX(-50%)" : "none",
                        }}
                      >
                        <motion.span
                          className="block text-sm"
                          initial={{
                            y: 0,
                            scale: 0,
                          }}
                          animate={{
                            y: [-30, -50],
                            scale: [0, 1, 0],
                            rotate: i === 1 ? [0, -15, 15, 0] : [0, 15, -15, 0],
                          }}
                          transition={{
                            duration: 2,
                            delay: i * 0.2,
                            repeat: Infinity,
                            repeatDelay: 1,
                            ease: "easeOut",
                          }}
                        >
                          {i === 0 ? "💕" : i === 1 ? "❤️" : "💖"}
                        </motion.span>
                      </motion.div>
                    ))}
                  </div>

                  <Link
                    href="https://github.com/IfcLCA/IfcLCA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-400 dark:from-yellow-500 dark:to-orange-500 rounded-lg hover:from-yellow-500 hover:to-orange-500 dark:hover:from-yellow-600 dark:hover:to-orange-600 transition-all duration-300 shadow-md hover:shadow-lg group relative overflow-hidden"
                  >
                    {/* Subtle shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-white/20"
                      animate={{
                        x: ["-100%", "100%"],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                      }}
                    />

                    <Star className="h-4 w-4 text-white fill-white relative z-10" />
                    <span className="text-sm font-medium text-white relative z-10">
                      Star on GitHub
                    </span>

                    {/* Single subtle sparkle */}
                    <motion.span
                      className="text-sm relative z-10 inline-block opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      animate={{
                        scale: [0.8, 1.1, 0.8],
                        rotate: [0, 180, 360],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      ✨
                    </motion.span>
                  </Link>
                </motion.div>
              </div>
            </div>

            {/* Links Section - Spans 8 columns */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Product */}
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Product</h4>
                  <ul className="space-y-2">
                    <li>
                      <Link href="/features" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors">
                        Features
                      </Link>
                    </li>
                    <li>
                      <Link href="/documentation" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors">
                        Documentation
                      </Link>
                    </li>
                    <li>
                      <Link href="/sign-in?redirect_url=/" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors">
                        Get Started
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Community */}
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Community</h4>
                  <ul className="space-y-2">
                    <li>
                      <Link href="https://github.com/IfcLCA/IfcLCA/issues" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors" target="_blank" rel="noopener noreferrer">
                        GitHub Issues
                      </Link>
                    </li>
                    <li>
                      <Link href="https://github.com/IfcLCA/IfcLCA/discussions" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors" target="_blank" rel="noopener noreferrer">
                        Discussions
                      </Link>
                    </li>
                    <li>
                      <Link href="/open-source-philosophy" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors">
                        Philosophy
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Resources */}
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Resources</h4>
                  <ul className="space-y-2">
                    <li>
                      <Link href="https://www.lcadata.ch" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors" target="_blank" rel="noopener noreferrer">
                        lcadata.ch
                      </Link>
                    </li>
                    <li>
                      <Link href="https://github.com/IfcLCA/IfcLCA" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors" target="_blank" rel="noopener noreferrer">
                        Source Code
                      </Link>
                    </li>
                    <li>
                      <Link href="https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors" target="_blank" rel="noopener noreferrer">
                        IFC Standard
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Legal */}
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm uppercase tracking-wider">Legal</h4>
                  <ul className="space-y-2">
                    <li>
                      <Link href="/privacy" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors">
                        Privacy
                      </Link>
                    </li>
                    <li>
                      <Link href="/terms" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors">
                        Terms
                      </Link>
                    </li>
                    <li>
                      <Link href="https://www.gnu.org/licenses/agpl-3.0.en.html" className="text-sm text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors" target="_blank" rel="noopener noreferrer">
                        AGPL-3.0
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <p>&copy; {new Date().getFullYear()} IfcLCA. All rights reserved.</p>
              <span className="hidden md:inline">•</span>
              <Link href="https://www.lt.plus" target="_blank" rel="noopener noreferrer" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Built by LT+
              </Link>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Shield className="h-4 w-4" />
              <span>AGPL-3.0 Licensed</span>
            </div>
          </div>
        </div>
      </footer>
  );
}
