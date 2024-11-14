import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Linkedin, Github, Mail, ExternalLink } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="IfcLCA Logo"
                width={24}
                height={24}
                className="h-6 w-6 rounded-lg"
              />
              <span className="font-bold text-sm">IfcLCA</span>
            </Link>
            <div className="flex space-x-2">
              <Link
                href="https://github.com/IfcLCA/IfcLCA"
                aria-label="GitHub"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </Link>
              <Link
                href="https://www.lt.plus"
                aria-label="LT Plus"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </Link>
              <Link
                href="https://www.linkedin.com/in/louistrue/"
                aria-label="LinkedIn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </Link>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/projects" className="hover:underline">
              Projects
            </Link>
            <Link href="/materials-library" className="hover:underline">
              Materials
            </Link>
            <span className="text-muted-foreground flex items-center gap-1 cursor-not-allowed">
              Reports
              <span className="text-[10px] text-muted-foreground">
                (Coming Soon)
              </span>
            </span>
          </nav>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="Enter your email"
              className="h-8 text-xs w-40 sm:w-auto"
            />
            <Button type="submit" size="sm" className="h-8">
              <Mail className="h-3 w-3" />
              <span className="sr-only">Subscribe</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p>© {currentYear} IfcLCA. All rights reserved.</p>
            <div className="flex items-center gap-1">
              <span>Powered by</span>
              <Link
                href="https://www.lcadata.ch"
                className="text-primary hover:underline flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                lcadata.ch
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
          <nav className="flex gap-4 text-xs">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:underline">
              Cookies
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
