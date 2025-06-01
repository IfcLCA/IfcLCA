import mongoose from "mongoose";

interface IProjectMembership {
  projectId: mongoose.Types.ObjectId;
  userId: string;
  role: "viewer" | "editor" | "uploader" | "manager";
  invitedBy?: string;
  status: "pending" | "accepted";
}

const projectMembershipSchema = new mongoose.Schema<IProjectMembership>(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["viewer", "editor", "uploader", "manager"],
      default: "viewer",
    },
    invitedBy: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

projectMembershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMembership =
  mongoose.models.ProjectMembership ||
  mongoose.model<IProjectMembership>("ProjectMembership", projectMembershipSchema);
