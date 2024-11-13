"use client";

import { MaterialLibraryComponent } from "@/components/materials-library";

export default function MaterialsLibraryPage() {
  return (
    <div className="main-container space-y-8">
      <section>
        <div className="page-header">
          <div>
            <h1 className="page-title">Material Library</h1>
            <p className="page-description">
              Match project materials with KBOB environmental indicators
            </p>
          </div>
        </div>
      </section>

      <MaterialLibraryComponent />
    </div>
  );
}
