"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Link from "next/link";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Project name must be at least 2 characters.",
  }),
  description: z.string().optional(),
});

export default function ProjectsNewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectCount, setProjectCount] = useState<number | null>(null);

  useEffect(() => {
    async function checkProjectCount() {
      try {
        const response = await fetch("/api/projects");
        const projects = await response.json();
        setProjectCount(projects.length);
      } catch (error) {
        console.error("Error checking project count:", error);
      }
    }
    checkProjectCount();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.message) {
          toast({
            title: "Project Limit Reached",
            description: data.message,
            variant: "destructive",
          });
          router.push('/projects');
          return;
        }
        throw new Error(data.error || "Failed to create project");
      }

      toast({
        title: "Success",
        description: "Project created successfully.",
      });

      router.push(`/projects/${data._id}`);
      router.refresh();
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const breadcrumbItems = [
    { label: "Projects", href: "/projects" },
    { label: "New Project", href: undefined },
  ];

  if (projectCount === null) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <Breadcrumbs items={breadcrumbItems} />
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (projectCount >= 3) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <Breadcrumbs items={breadcrumbItems} />
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Project Limit Reached</CardTitle>
            <CardDescription>
              You currently have {projectCount} projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-muted-foreground space-y-4">
              <p>
                Databases cost real money 💸 and while we would like to offer the most to all users in an effort to push sustainable construction, IfcLCA is still fully bootstrapped.
              </p>
              <p>
                We have plans for many more powerful features once we&apos;re out of BETA! 🚀
              </p>
              <p>
                Stay tuned and get in touch if you really need more projects today (or let&apos;s maybe say tomorrow 😉)
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild>
              <Link href="/projects">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Breadcrumbs items={breadcrumbItems} />
      <Card className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <PlusCircle className="h-6 w-6 text-muted-foreground" />
                New Project
              </CardTitle>
              <CardDescription>
                Create a new project to start your LCA analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter project description (optional)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Project
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
