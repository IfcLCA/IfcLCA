import { ViewerPage } from "@/components/viewer-page";

export default async function Viewer3DPage({
  params,
}: {
  params: { id: string };
}) {
  const modelId = `model-${params.id}`;
  const modelPath = `/api/models/${params.id}/model.xkt`;

  return <ViewerPage modelId={modelId} modelPath={modelPath} />;
}
