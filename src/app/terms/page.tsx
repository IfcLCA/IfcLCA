import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - IfcLCA Usage Agreement",
  description: "Read IfcLCA's terms of service and usage agreement. Understand your rights and responsibilities when using our open-source LCA platform.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://ifclca.com/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>1. Service Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            IfcLCA provides a web-based platform for conducting Life Cycle
            Assessment (LCA) calculations on building models using Ifc (Industry
            Foundation Classes) files. Our service includes material analysis,
            environmental impact calculations, and report generation.
          </p>
          <p>
            IfcLCA is licensed under the{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.en.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GNU Affero General Public License v3.0 (AGPL-3.0)
            </a>{" "}
            . The source code of our software is freely available on{" "}
            <a
              href="https://github.com/IfcLCA/IfcLCA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>2. Open Source License</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>In accordance with the AGPL-3.0 license, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the software for any purpose</li>
            <li>Study how the software works and modify it</li>
            <li>Redistribute copies of the software</li>
            <li>Distribute modified versions of the software</li>
          </ul>
          <p className="mt-4">
            If you modify IfcLCA and provide it to others as a service, you
            must:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Make your modified source code available to users</li>
            <li>License your modifications under AGPL-3.0</li>
            <li>Provide clear attribution to the original IfcLCA project</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>3. User Responsibilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Users of IfcLCA agree to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Provide accurate and complete information when using the service
            </li>
            <li>Maintain the confidentiality of their account credentials</li>
            <li>
              Use the service in compliance with applicable laws and regulations
            </li>
            <li>Not attempt to compromise the service</li>
            <li>Not share access to their account with unauthorized users</li>
            <li>
              Comply with the terms of the AGPL-3.0 license when using or
              modifying the software
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>4. Data Usage and Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            We handle your data in accordance with our Privacy Policy. By using
            IfcLCA, you acknowledge that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your uploaded Ifc files are processed and stored securely</li>
            <li>Calculation results are associated with your account</li>
            <li>
              Anonymous usage statistics may be collected to improve the service
            </li>
            <li>You retain ownership of your uploaded content</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>5. Intellectual Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            The IfcLCA platform is open-source software. While we maintain
            copyright of our original work, it is freely available under the
            terms of the AGPL-3.0 license.
          </p>
          <p>
            The environmental impact data provided through lcadata.ch is subject
            to its own terms and licensing conditions.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>6. Liability and Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            As per the AGPL-3.0 license, IfcLCA is provided &quot;as is&quot; without
            warranty of any kind. While we strive for accuracy, IfcLCA:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provides calculations based on available environmental data</li>
            <li>Makes no guarantees about the accuracy of results</li>
            <li>Is not liable for decisions made based on the output</li>
            <li>May experience occasional service interruptions</li>
          </ul>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground mt-8">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p>
          For questions about these terms, please contact us at{" "}
          <a
            href="mailto:info@lt.plus"
            className="text-primary hover:underline"
          >
            info@lt.plus
          </a>
        </p>
      </div>
    </div>
  );
}
