"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Github,
  Linkedin,
  Globe,
  Video,
  Users,
} from "lucide-react";

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HelpCircle className="h-4 w-4" />
          <span className="sr-only">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>About IfcLCA</DialogTitle>
          <DialogDescription>
            Open Source Life Cycle Assessment for the AECO industry
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            IfcLCA leverages openBIM and Open Data Standards to analyze
            environmental impact of construction projects through IFC files
            across the entire project lifecycle using Swiss KBOB data from{" "}
            <a
              href="https://lcadata.ch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              lcadata.ch
            </a>
            {""}.
          </p>

          <div className="space-y-2">
            <h4 className="font-medium">Creator</h4>
            <p className="text-sm text-muted-foreground">
              Built by{" "}
              <a
                href="https://www.linkedin.com/in/louistrue/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Louis Trümpler
              </a>
              , combining an extensive construction background with digital
              innovation to create sustainable solutions for the built
              environment.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Open Source</h4>
            <p className="text-sm text-muted-foreground">
              IfcLCA is and will always be Open Source. Sustainability is a team
              effort and requires trust and transparency. Check out the source
              code on GitHub and join our community, any feedback or requests
              are valuable. The project is licensed under{" "}
              <a
                href="https://www.gnu.org/licenses/agpl-3.0.en.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                AGPL-3.0
              </a>
              .
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/IfcLCA/IfcLCA"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://lt.plus"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  LT Plus
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Community</h4>
            <p className="text-sm text-muted-foreground">
              Join our community to discuss features, share ideas, and get help.
              Watch my presentation at the opensource.construction monthly
              meetup to learn more about the project.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/IfcLCA/IfcLCA/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Community Forum
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://www.youtube.com/watch?v=r31YEUAzAuE"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Video className="mr-2 h-4 w-4" />
                  OSC Presentation
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
