"use client";

import { useState, useEffect } from "react";
import { FileUp, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Upload {
  id: string;
  filename: string;
  fileSize: number | null;
  status: string;
  elementCount: number;
  materialCount: number;
  createdAt: string;
}

interface UploadHistoryProps {
  projectId: string;
}

export function UploadHistory({ projectId }: UploadHistoryProps) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/uploads`)
      .then((r) => r.json())
      .then((data) => setUploads(data.uploads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading history...
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <FileUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
        No uploads yet
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Upload History
      </h4>
      {uploads.map((upload) => (
        <div
          key={upload.id}
          className="flex items-center gap-3 rounded-lg border p-3 text-sm"
        >
          <div className="shrink-0">
            {upload.status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : upload.status === "processing" ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{upload.filename}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {upload.fileSize && (
                <span>{formatFileSize(upload.fileSize)}</span>
              )}
              <span>{upload.elementCount} elements</span>
              <span>{upload.materialCount} materials</span>
            </div>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-1" />
            {new Date(upload.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
