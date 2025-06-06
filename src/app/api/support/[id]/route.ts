import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SupportTicket } from "@/models";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  await connectToDatabase();

  const ticket = await SupportTicket.findById(params.id).lean();
  if (!ticket) return new NextResponse("Not Found", { status: 404 });

  const isAdmin = process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
  if (!isAdmin && ticket.userId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.json({
    id: ticket._id.toString(),
    userId: ticket.userId,
    subject: ticket.subject,
    status: ticket.status,
    messages: ticket.messages,
    createdAt: ticket.createdAt,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  await connectToDatabase();

  const ticket = await SupportTicket.findById(params.id);
  if (!ticket) return new NextResponse("Not Found", { status: 404 });

  const isAdmin = process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
  if (!isAdmin && ticket.userId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  if (body.message) {
    ticket.messages.push({
      sender: isAdmin ? "admin" : "user",
      text: body.message,
      createdAt: new Date(),
    });
  }
  if (isAdmin && body.status) {
    ticket.status = body.status;
  } else if (!isAdmin) {
    ticket.status = "open";
  }
  await ticket.save();

  return NextResponse.json({ success: true });
}
