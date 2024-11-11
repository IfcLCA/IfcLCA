"use client";

// ... other imports ...

export default function UploadPage() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleUpload = async (file: File) => {
    try {
      setProcessing(true);
      setError(null);

      // Upload file
      const uploadResponse = await uploadFile(file);
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error || "Upload failed");
      }

      // Process elements
      const processResponse = await processElements(uploadResponse.uploadId);
      if (!processResponse.success) {
        throw new Error(processResponse.error || "Processing failed");
      }

      // Show success or partial success message
      if (processResponse.errorCount > 0) {
        setError(
          `Upload completed with ${processResponse.errorCount} errors. ${processResponse.savedCount} elements saved successfully.`
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "An unexpected error occurred");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      {processing && <div className="processing-message">Processing...</div>}
      {/* Rest of your component */}
    </div>
  );
}
