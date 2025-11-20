"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoCircledIcon } from "@radix-ui/react-icons";

interface DensityInputModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (density: number) => void;
  materialName: string;
  category?: string;
  suggestedDensity?: {
    min: number;
    max: number;
    typical: number;
    unit: string;
  };
}

export function DensityInputModal({
  open,
  onClose,
  onConfirm,
  materialName,
  category,
  suggestedDensity,
}: DensityInputModalProps) {
  const [density, setDensity] = useState<string>(
    suggestedDensity?.typical?.toString() || ""
  );
  const [error, setError] = useState<string>("");
  
  const handleConfirm = () => {
    const value = parseFloat(density);
    
    if (!density || isNaN(value)) {
      setError("Please enter a valid density value");
      return;
    }
    
    if (value <= 0) {
      setError("Density must be greater than 0");
      return;
    }
    
    if (value > 20000) {
      setError("Density seems too high. Please check the value");
      return;
    }
    
    // Validate against suggested range if available
    if (suggestedDensity) {
      const tolerance = 0.5; // 50% tolerance
      const minAllowed = suggestedDensity.min * (1 - tolerance);
      const maxAllowed = suggestedDensity.max * (1 + tolerance);
      
      if (value < minAllowed || value > maxAllowed) {
        setError(
          `Density is outside the expected range (${suggestedDensity.min}-${suggestedDensity.max} ${suggestedDensity.unit}). Please verify.`
        );
        // Don't return - allow user to proceed if they're sure
      }
    }
    
    onConfirm(value);
    setDensity("");
    setError("");
  };
  
  const handleClose = () => {
    setDensity("");
    setError("");
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Density Required</DialogTitle>
          <DialogDescription>
            The selected material doesn't have density information. 
            Please provide the density to calculate environmental impacts.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Material</Label>
            <div className="text-sm text-muted-foreground">
              {materialName}
              {category && <span className="block text-xs">Category: {category}</span>}
            </div>
          </div>
          
          {suggestedDensity && (
            <Alert>
              <InfoCircledIcon className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Suggested density range:</span>
                <br />
                {suggestedDensity.min} - {suggestedDensity.max} {suggestedDensity.unit}
                <br />
                <span className="text-xs">
                  Typical: {suggestedDensity.typical} {suggestedDensity.unit}
                </span>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="density">
              Density (kg/m³) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="density"
              type="number"
              placeholder={suggestedDensity ? suggestedDensity.typical.toString() : "Enter density"}
              value={density}
              onChange={(e) => {
                setDensity(e.target.value);
                setError("");
              }}
              min="0"
              step="0.01"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>Common densities:</p>
            <ul className="ml-4 mt-1 space-y-0.5">
              <li>• Concrete: 2400 kg/m³</li>
              <li>• Steel: 7850 kg/m³</li>
              <li>• Wood: 500-800 kg/m³</li>
              <li>• Insulation: 20-200 kg/m³</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm Density
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}







