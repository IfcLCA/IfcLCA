import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocumentationPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Documentation</h1>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Register</strong> — Use the sign-up link and create your account
              with Clerk.
            </li>
            <li>
              <strong>Create a Project</strong> — Click <em>New Project</em> on your
              dashboard and provide a name.
            </li>
            <li>
              <strong>Upload an IFC</strong> — Export your BIM model with materials and
              <em>Ifc Base Quantities</em> included, then upload it from the project
              page.
            </li>
            <li>
              <strong>Map Materials</strong> — Open the <em>Materials</em> tab and search
              the KBOB database for each material to combine your model with
              environmental impact data.
            </li>
            <li>
              <strong>View Charts</strong> — Check the <em>Charts</em> tab to explore GWP,
              UBP and PEnr graphs. Use the printer icon to save charts as PDF
              files.
            </li>
            <li>
              <strong>Export Tables</strong> — The <em>Materials</em> and <em>Elements</em>
              tables can be exported for offline use.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
