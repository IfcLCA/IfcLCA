"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadProjectImage } from "@/app/actions/upload-image";

interface ProjectImageUploadProps {
  projectId: string;
  imageUrl?: string;
}

export function ProjectImageUpload({
  projectId,
  imageUrl,
}: ProjectImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const { toast } = useToast();

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // Upload using server action
      const newImageUrl = await uploadProjectImage(projectId, formData);

      setCurrentImageUrl(newImageUrl);
      toast({
        title: "Success",
        description: "Project image updated successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">

      <CardContent className="flex-1 p-0">
        <div className="h-full flex flex-col items-center justify-center w-full rounded-xl bg-muted/5 hover:bg-muted/10 transition-colors">
          {currentImageUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={currentImageUrl}
                alt="Project image"
                fill
                className="object-cover rounded-lg"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="relative overflow-hidden bg-white/10 backdrop-blur-sm"
                  disabled={isUploading}
                >
                  <ImageIcon className="h-3 w-3 mr-2" />
                  {isUploading ? "Uploading..." : "Change Image"}
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground mb-4 text-center px-2">
                No project image uploaded
              </p>
              <Button
                variant="outline"
                size="sm"
                className="relative overflow-hidden"
                disabled={isUploading}
              >
                <ImageIcon className="h-3 w-3 mr-2" />
                {isUploading ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
