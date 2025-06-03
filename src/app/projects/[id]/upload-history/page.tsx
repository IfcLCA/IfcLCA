import { UploadHistoryClient } from "@/components/upload-history-client";

export default function UploadHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  return <UploadHistoryClient projectId={params.id} />;
}
