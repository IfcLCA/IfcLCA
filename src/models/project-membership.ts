import mongoose from "mongoose";

interface IProjectMembership {
  projectId: mongoose.Types.ObjectId;
  userId: string;
  role: string;
  status: "pending" | "accepted";
}

const projectMembershipSchema = new mongoose.Schema<IProjectMembership>(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    role: { type: String, default: "member" },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
  },
  { timestamps: true }
);

projectMembershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMembership =
  mongoose.models.ProjectMembership ||
  mongoose.model<IProjectMembership>("ProjectMembership", projectMembershipSchema);
