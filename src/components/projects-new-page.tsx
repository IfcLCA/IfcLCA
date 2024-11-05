"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const formSchema = z.object({
  projectName: z.string().min(2, {
    message: "Project name must be at least 2 characters.",
  }),
  projectPhase: z.string({
    required_error: "Please select a project phase.",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }),
  projectImage: z
    .any()
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
      "Only .jpg, .png, and .webp formats are supported."
    )
    .optional(),
  teamMembers: z.array(z.string()).min(1, {
    message: "Please add at least one team member.",
  }),
});

const teamMembers = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    avatar: "/placeholder.svg?height=32&width=32",
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    avatar: "/placeholder.svg?height=32&width=32",
  },
  {
    id: "3",
    name: "Charlie Brown",
    email: "charlie@example.com",
    avatar: "/placeholder.svg?height=32&width=32",
  },
  {
    id: "4",
    name: "Diana Ross",
    email: "diana@example.com",
    avatar: "/placeholder.svg?height=32&width=32",
  },
];

export function ProjectNewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: "",
      projectPhase: "",
      description: "",
      teamMembers: [],
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    // In a real application, you would send this data to your backend
    console.log(values);

    // Simulate an API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Project Created",
        description: "Your new project has been successfully created.",
      });
      router.push("/projects");
    }, 2000);
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("projectImage", file);
    }
  };

  const addTeamMember = (memberId: string) => {
    if (!selectedTeamMembers.includes(memberId)) {
      setSelectedTeamMembers([...selectedTeamMembers, memberId]);
      form.setValue("teamMembers", [...selectedTeamMembers, memberId]);
    }
  };

  const removeTeamMember = (memberId: string) => {
    const updatedMembers = selectedTeamMembers.filter((id) => id !== memberId);
    setSelectedTeamMembers(updatedMembers);
    form.setValue("teamMembers", updatedMembers);
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
          <CardDescription>
            Set up a new project for Life Cycle Assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
                    </FormControl>
                    <FormDescription>
                      This is the name that will be used to identify your
                      project.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectPhase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Phase</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project phase" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="construction">
                          Construction
                        </SelectItem>
                        <SelectItem value="operation">Operation</SelectItem>
                        <SelectItem value="demolition">Demolition</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter a brief description of your project"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Image</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".jpg,.png,.webp"
                        onChange={handleImageUpload}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload an image for your project (max 5MB, .jpg, .png, or
                      .webp)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teamMembers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Members</FormLabel>
                    <FormControl>
                      <Select onValueChange={(value) => addTeamMember(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Add team members" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTeamMembers.map((memberId) => {
                        const member = teamMembers.find(
                          (m) => m.id === memberId
                        );
                        return member ? (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={member.avatar}
                                alt={member.name}
                              />
                              <AvatarFallback>
                                {member.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            {member.name}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => removeTeamMember(member.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
