import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useState } from "react";

interface TermsAcceptanceModalProps {
  open: boolean;
  onAccept: () => void;
}

export function TermsAcceptanceModal({
  open,
  onAccept,
}: TermsAcceptanceModalProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Welcome to IfcLCA!</DialogTitle>
          <DialogDescription>
            Here to help you optimize your construction projects through Life Cycle Assessment
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] rounded-md border p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">What is IfcLCA?</h3>
              <p className="text-muted-foreground">
                IfcLCA lets you analyze the environmental impact
                of your construction projects using Ifc (Industry Foundation Classes) files.
                It automates the process of material analysis, environmental impact calculations, and report generation.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
              <ol className="space-y-4 list-decimal pl-6">
                <li>
                  <span className="font-medium block">Create a New Project</span>
                  <p className="text-muted-foreground">
                    Start by creating a project to organize your LCA calculations
                  </p>
                </li>
                <li>
                  <span className="font-medium block">Upload Your Ifc Model</span>
                  <p className="text-muted-foreground">
                    Import your Ifc model and assign environmental impact data
                  </p>
                </li>
                <li>
                  <span className="font-medium block">Review Materials</span>
                  <p className="text-muted-foreground">
                    Verify the materials detected in your model and their environmental properties
                  </p>
                </li>
                <li>
                  <span className="font-medium block">Generate Reports</span>
                  <p className="text-muted-foreground">
                    Get detailed environmental impact calculations and insights
                  </p>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Key Features</h3>
              <ul className="space-y-2 list-disc pl-6">
                <li className="text-muted-foreground">
                  Automatic material detection from Ifc files
                </li>
                <li className="text-muted-foreground">
                  Environmental impact calculations using data from swiss KBOB list through lcadata.ch
                </li>
                <li className="text-muted-foreground">
                  Multiple environmental indicators (GWP, PENRE, UBP), for now without amortization or project area
                </li>
                <li className="text-muted-foreground">
                  Detailed reports and visualizations of absolute emissions
                </li>
              </ul>
            </div>

            <div className="pt-4">
              <p className="text-sm text-muted-foreground">
                By using IfcLCA, you agree to our{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center space-x-2 pt-4">
          <Checkbox
            id="terms"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked as boolean)}
          />
          <label
            htmlFor="terms"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I accept the Terms of Service and Privacy Policy
          </label>
        </div>

        <DialogFooter>
          <Button onClick={onAccept} disabled={!accepted} size="lg">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
