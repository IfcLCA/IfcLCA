"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  messages: { sender: string; text: string; createdAt: string }[];
}

export function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});

  const fetchTickets = async () => {
    const res = await fetch("/api/support");
    const data = await res.json();
    setTickets(data);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;
    setLoading(true);
    await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    setSubject("");
    setMessage("");
    await fetchTickets();
    setLoading(false);
  };

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Create Support Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTicket} className="space-y-4">
            <Input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              placeholder="Describe your issue"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              Submit
            </Button>
          </form>
        </CardContent>
      </Card>
      {tickets.map((ticket) => (
        <Card key={ticket.id} className="max-w-2xl">
          <CardHeader>
            <CardTitle>
              {ticket.subject}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({ticket.status})
              </span>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
