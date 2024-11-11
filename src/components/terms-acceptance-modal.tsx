import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

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
          <DialogTitle>Terms of Service & Privacy Policy</DialogTitle>
          <DialogDescription>
            Please read and accept our Terms of Service and Privacy Policy to
            continue.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[280px] rounded-md border p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Terms of Service</h3>
            <p className="text-sm text-muted-foreground">
              By using IfcLCA, you agree to our terms of service which includes
              the usage of our platform under the AGPL-3.0 license.
            </p>

            <h3 className="text-lg font-semibold">Privacy Policy</h3>
            <p className="text-sm text-muted-foreground">
              We collect and process your data as described in our privacy
              policy to provide and improve our services.
            </p>

            <div className="pt-4">
              <p className="text-sm text-muted-foreground">
                For full details, please read our{" "}
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
          <Button onClick={onAccept} disabled={!accepted}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
