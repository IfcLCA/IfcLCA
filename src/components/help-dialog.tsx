"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Github,
  Linkedin,
  Globe,
  Video,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HelpCircle className="h-4 w-4" />
          <span className="sr-only">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>About IfcLCA</DialogTitle>
          <DialogDescription>
            Open Source Life Cycle Assessment for the AECO industry
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="about" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="docs">How it Works</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="h-[600px] overflow-y-auto data-[state=active]:block space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4 text-orange-500" />
                      Overview
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      IfcLCA leverages openBIM and Open Data Standards to analyze
                      environmental impact of construction projects through Ifc files
                      using Swiss KBOB data from{" "}
                      <a
                        href="https://lcadata.ch"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        lcadata.ch
                      </a>
                      .
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-500" />
                      Creator
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Built by{" "}
                      <a
                        href="https://www.linkedin.com/in/louistrue/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Louis Trümpler
                      </a>
                      , combining construction expertise with digital innovation to create sustainable solutions and make environmental impact assessment accessible to everyone.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Github className="h-4 w-4 text-orange-500" />
                    Open Source
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    IfcLCA is and will always be Open Source. Sustainability is a team
                    effort and requires trust and transparency. The project is licensed under{" "}
                    <a
                      href="https://www.gnu.org/licenses/agpl-3.0.en.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      AGPL-3.0
                    </a>
                    .
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://github.com/IfcLCA/IfcLCA"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Github className="mr-2 h-4 w-4" />
                        GitHub
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://lt.plus"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        LT Plus
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Video className="h-4 w-4 text-orange-500" />
                    Community
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Join our community to discuss features, share ideas, and get help.
                    Watch the presentation at opensource.construction to learn more.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://github.com/IfcLCA/IfcLCA/discussions"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Community Forum
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://www.youtube.com/watch?v=r31YEUAzAuE"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Video className="mr-2 h-4 w-4" />
                        OSC Community Standup on Youtube
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="h-[600px] overflow-y-auto data-[state=active]:block space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl font-bold text-orange-500">1</div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Export your Model</h4>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>Export an Ifc file from your BIM software with these settings:</p>
                        <div className="grid grid-cols-1 gap-2 pl-4">
                          <div>
                            <ul className="list-disc list-inside">
                              <li>Ifc version: preferrably <span className="font-bold">IFC4</span>, 2x3 should work too</li>
                              <li>Include all "Ifc Base Quantities" in the file, we use <span className="font-bold">NetVolume or GrossVolume</span></li>
                              <li>Include all assembly layers during export, we prefer <span className="font-bold">IfcMaterialLayerset</span> but can work with <span className="font-bold">IfcMaterialConstituentSet</span> as well</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl font-bold text-orange-500">2</div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Upload</h4>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>Drop your IFC file in the upload area or click to browse:</p>
                        <ul className="list-disc list-inside">
                          <li>Files are processed locally</li>
                          <li>Ifc don't get stored on our servers</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl font-bold text-orange-500">3</div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Map Materials</h4>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>Match your model materials with KBOB datasets:</p>
                        <ul className="list-disc list-inside">
                          <li>Search full KBOB database</li>
                          <li>Combine your materials with environmental impact data</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl font-bold text-orange-500">4</div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Analyze Results</h4>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>View comprehensive environmental impact metrics:</p>
                        <div className="grid grid-cols-1 gap-2 pl-4">
                          <div>
                            <h5 className="font-medium text-foreground">Impact Metrics</h5>
                            <ul className="list-disc list-inside">
                              <li>Global Warming Potential (GWP)</li>
                              <li>Non-renewable Primary Energy (PEnr)</li>
                              <li>Swiss Environmental Impact Points (UBP)</li>
                              <li>Material breakdown</li>
                            </ul>
                          </div>
                          <div className="mt-2">
                            <h5 className="font-medium text-foreground">Analysis Tools</h5>
                            <ul className="list-disc list-inside">
                              <li>Interactive Charts to visualize results</li>
                              <li>Material hotspots to identify areas of concern</li>
                              <li>Comparative analysis with other projects</li>
                              <li>Export reports (Coming Soon...)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-orange-500" />
                      Need Help?
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>Having trouble with your analysis? Here are some common solutions:</p>
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <h5 className="font-medium text-foreground">Common Issues</h5>
                          <ul className="list-disc list-inside">
                            <li>Missing quantities in IFC</li>
                            <li>Unmatched materials</li>
                            <li>Large file processing</li>
                            <li>Export settings</li>
                          </ul>
                        </div>
                        <div className="mt-2">
                          <h5 className="font-medium text-foreground">Get Support</h5>
                          <ul className="list-disc list-inside">
                            Join our community, report issues or ask for help if things go wrong: <a href="https://github.com/IfcLCA/IfcLCA/discussions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Community Forum</a>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
