import Link from "next/link";
import { Shield } from "lucide-react";

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-gray-100/80 dark:bg-gray-900/50 backdrop-blur-sm py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <nav className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <Link href="/features" className="hover:text-orange-600 dark:hover:text-orange-400">
            Features
          </Link>
          <Link href="/try" className="hover:text-orange-600 dark:hover:text-orange-400">
            Try Now
          </Link>
          <Link href="/documentation" className="hover:text-orange-600 dark:hover:text-orange-400">
            Documentation
          </Link>
          <Link href="/open-source-philosophy" className="hover:text-orange-600 dark:hover:text-orange-400">
            Philosophy
          </Link>
        </nav>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <p>&copy; {currentYear} IfcLCA. All rights reserved.</p>
            <span className="hidden md:inline">•</span>
            <Link
              href="https://www.lt.plus"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
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
