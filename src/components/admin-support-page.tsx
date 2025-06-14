"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Ticket {
  id: string;
  userId: string;
  subject: string;
  status: string;
  messages: { sender: string; text: string; createdAt: string }[];
}

export function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});

  const fetchTickets = async () => {
    const res = await fetch("/api/support");
    const data = await res.json();
    setTickets(data);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const sendReply = async (id: string) => {
    const text = reply[id];
    if (!text) return;
    await fetch(`/api/support/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    setReply({ ...reply, [id]: "" });
    fetchTickets();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/support/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchTickets();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {tickets.map((ticket) => (
        <Card key={ticket.id} className="max-w-2xl">
          <CardHeader>
            <CardTitle>
              {ticket.subject} – {ticket.userId}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {ticket.messages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium mr-1">{m.sender}:</span>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Reply..."
                value={reply[ticket.id] || ""}
                onChange={(e) =>
                  setReply({ ...reply, [ticket.id]: e.target.value })
                }
              />
              <Button
                type="button"
                onClick={() => sendReply(ticket.id)}
                disabled={!reply[ticket.id]}
              >
                Send
              </Button>
            </div>
            <div className="pt-2">
              <Select
                value={ticket.status}
                onValueChange={(value) => updateStatus(ticket.id, value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
