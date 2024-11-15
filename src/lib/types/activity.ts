export interface Activity {
  id: string;
  type:
    | "project_created"
    | "file_uploaded"
    | "material_created"
    | "project_deleted"
    | "material_deleted"
    | "project_updated"
    | "new_user"
    | "project_member_added"
    | "project_member_removed"
    | "image_uploaded";
  user: {
    name: string;
    imageUrl: string;
  };
  action: string;
  project: string;
  projectId: string;
  timestamp: string;
  details: {
    description?: string;
    fileName?: string;
    elementCount?: number;
    imageUrl?: string;
    changes?: {
      name?: string;
      description?: string;
    };
  };
}
