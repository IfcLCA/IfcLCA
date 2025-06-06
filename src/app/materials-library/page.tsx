import { MaterialLibraryComponent } from "@/components/materials-library";
import { Metadata } from "next";

// Since this page is behind authentication, prevent indexing
export const metadata: Metadata = {
  title: "Materials Library - KBOB Environmental Impact Database",
  description: "Browse Swiss KBOB environmental impact data for construction materials. Find GWP, UBP, and PENRE values for life cycle assessment calculations.",
  robots: {
    index: false, // Don't index authenticated pages
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

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
