import { MaterialsLibrary } from "@/components/materials-library";

export default function MaterialsLibraryPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Materials Library</h1>
      <MaterialsLibrary />
    </div>
  );
}
