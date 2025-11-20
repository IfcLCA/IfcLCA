"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";

interface DataSourceToggleProps {
  value: 'kbob' | 'okobaudat';
  onChange: (value: 'kbob' | 'okobaudat') => void;
  disabled?: boolean;
}

export function DataSourceToggle({ 
  value, 
  onChange, 
  disabled = false 
}: DataSourceToggleProps) {
  return (
    <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
      <Label className="text-sm font-medium">Data Source:</Label>
      <RadioGroup 
        value={value} 
        onValueChange={onChange}
        disabled={disabled}
        className="flex items-center space-x-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="kbob" id="kbob" />
          <Label 
            htmlFor="kbob" 
            className="cursor-pointer flex items-center space-x-1"
          >
            <span className="text-lg">🇨🇭</span>
            <span>KBOB</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Swiss construction materials database with 314+ materials.
                    Pre-loaded for instant access.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="okobaudat" id="okobaudat" />
          <Label 
            htmlFor="okobaudat" 
            className="cursor-pointer flex items-center space-x-1"
          >
            <span className="text-lg">🇩🇪</span>
            <span>Ökobaudat</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    German environmental database with 1000+ EPDs.
                    EN 15804+A2 compliant. Real-time API access.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
        </div>
      </RadioGroup>
      
      {value === 'okobaudat' && (
        <div className="ml-auto">
          <span className="text-xs text-muted-foreground">
            API Status: <span className="text-green-600">● Connected</span>
          </span>
        </div>
      )}
    </div>
  );
}







