import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>1. Data Collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Account information (email, name) for authentication</li>
            <li>Ifc files that you upload for analysis</li>
            <li>Calculation results and reports generated from your data</li>
            <li>Usage data to improve our service</li>
            <li>
              Technical information (browser type, IP address) for service
              delivery
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>2. Data Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Your data is used for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Performing LCA calculations on your building models</li>
            <li>Generating environmental impact reports</li>
            <li>Improving our service and algorithms</li>
            <li>Maintaining and securing your account</li>
          </ul>
          <p className="mt-4">
            As an open-source project, we are committed to transparency in how
            we handle your data. Our source code is available for review on{" "}
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
          <CardTitle>3. Data Storage and Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We implement the following security measures:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Encryption of data in transit using HTTPS</li>
            <li>Secure storage of Ifc files and calculation results</li>
            <li>Regular security updates and monitoring</li>
            <li>Access controls and authentication mechanisms</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>4. Data Sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We share data only in the following circumstances:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>With your explicit consent</li>
            <li>With team members you&apos;ve granted access to your projects</li>
            <li>With service providers who help operate our platform</li>
            <li>When required by law or to protect our rights</li>
          </ul>
          <p className="mt-4">
            We do not sell your personal data or uploaded content to third
            parties.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>5. Your Rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data in a machine-readable format</li>
            <li>Object to certain data processing</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>6. Cookies and Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We use cookies and similar technologies for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Maintaining your session and authentication</li>
            <li>Remembering your preferences</li>
            <li>Understanding how you use our service</li>
            <li>Improving performance and user experience</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>7. Third-Party Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Authentication services through Clerk</li>
            <li>Environmental impact data from lcadata.ch</li>
            <li>Cloud storage and processing services</li>
          </ul>
          <p className="mt-4">
            Each third-party service has its own privacy policy and data
            handling practices.
          </p>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground mt-8">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p>
          For privacy-related inquiries, please contact us at{" "}
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
