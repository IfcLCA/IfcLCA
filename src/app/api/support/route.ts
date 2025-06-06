import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SupportTicket } from "@/models";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  await connectToDatabase();

  const isAdmin = process.env.ADMIN_USER_ID &&
    userId === process.env.ADMIN_USER_ID;

  const tickets = await SupportTicket.find(isAdmin ? {} : { userId })
    .sort({ createdAt: -1 })
    .lean();

  const data = tickets.map((t: any) => ({
    id: t._id.toString(),
    userId: t.userId,
    subject: t.subject,
    status: t.status,
    messages: t.messages,
    createdAt: t.createdAt,
  }));

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  if (!body.subject || !body.message) {
    return NextResponse.json({ error: "Subject and message required" }, { status: 400 });
  }

  await connectToDatabase();

  const ticket = await SupportTicket.create({
    userId,
    subject: body.subject,
    messages: [{ sender: "user", text: body.message }],
  });

  return NextResponse.json({ id: ticket._id.toString() });
}
