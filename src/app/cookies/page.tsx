import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CookiesPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Cookie Policy</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>1. What Are Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Cookies are small text files that are stored on your device when you
            visit our website. They help us provide you with a better experience
            and are essential for some of our website&apos;s functionality.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>2. Essential Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            These cookies are necessary for the website to function and cannot
            be disabled:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Authentication cookies (managed by Clerk)</li>
            <li>Session cookies to maintain your login state</li>
            <li>CSRF tokens for security</li>
            <li>Basic website functionality cookies</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>3. Performance Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>These cookies help us understand how visitors use our site:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Analytics cookies to measure visitor traffic</li>
            <li>Performance monitoring</li>
            <li>Error tracking</li>
          </ul>
          <p className="mt-4">
            We use this data to improve our service and fix issues more quickly.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>4. Functional Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>These cookies enable enhanced functionality:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Remembering your preferences</li>
            <li>Storing your selected settings</li>
            <li>Maintaining your session across pages</li>
            <li>Remembering your region and language preferences</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>5. Third-Party Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Some third-party services we use may set their own cookies:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Clerk (authentication service)</li>
            <li>GitHub (for source code repository links)</li>
          </ul>
          <p className="mt-4">
            These services have their own privacy and cookie policies which you
            can review on their respective websites.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>6. Managing Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>You can manage cookies in your browser settings:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <a
                href="https://support.google.com/chrome/answer/95647"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Chrome
              </a>
            </li>
            <li>
              <a
                href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a
                href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Microsoft Edge
              </a>
            </li>
            <li>
              <a
                href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Safari
              </a>
            </li>
          </ul>
          <p className="mt-4 text-muted-foreground">
            Note: Disabling essential cookies may affect the functionality of
            our service.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>7. Updates to This Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            We may update this cookie policy to reflect changes in our practices
            or for operational, legal, or regulatory reasons. We encourage you
            to review this policy periodically.
          </p>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground mt-8">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p>
          For questions about our cookie policy, please contact us at{" "}
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
