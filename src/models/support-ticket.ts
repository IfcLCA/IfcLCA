import mongoose from "mongoose";

interface Message {
  sender: "user" | "admin";
  text: string;
  createdAt: Date;
}

interface ISupportTicket extends mongoose.Document {
  userId: string;
  subject: string;
  messages: Message[];
  status: "open" | "closed";
}

const messageSchema = new mongoose.Schema<Message>(
  {
    sender: { type: String, enum: ["user", "admin"], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema<ISupportTicket>(
  {
    userId: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
    status: { type: String, enum: ["open", "closed"], default: "open" },
  },
  {
    timestamps: true,
  }
);

export const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicket>("SupportTicket", supportTicketSchema);
