"use client";

import { MaterialLibraryComponent } from "@/components/materials-library";

export default function MaterialsLibraryPage() {
  return (
    <div className="main-container">
      <div className="page-header mb-4">
        <div>
          <h1 className="page-title">Material Library</h1>
          <p className="page-description">
            Match project materials with KBOB environmental indicators
          </p>
        </div>
      </div>

      <MaterialLibraryComponent />
    </div>
  );
}
