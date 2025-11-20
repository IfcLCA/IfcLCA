import { UploadHistoryClient } from "@/components/upload-history-client";

export default async function UploadHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UploadHistoryClient projectId={id} />;
}
