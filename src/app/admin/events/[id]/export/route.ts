import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/admin";
import { asFormFields } from "@/lib/events/data";
import { formatDateTime } from "@/lib/events/time";
import type { EventRegistrationRow } from "@/lib/events/types";

export const dynamic = "force-dynamic";

/** CSV that opens cleanly in Excel / Google Sheets (UTF-8 BOM, quoted cells, formula-injection safe). */
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop Excel treating user input as a formula
  return `"${s.replace(/"/g, '""')}"`;
}

const STATUS_LABEL: Record<string, string> = { confirmed: "Confirmed", pending_payment: "Payment to verify", cancelled: "Removed / rejected" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminClient();
  if (!admin) return new NextResponse("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const { data: event } = await admin.supabase.from("events").select("slug, title, form_fields").eq("id", id).maybeSingle();
  if (!event) return new NextResponse("Not found", { status: 404 });

  const status = req.nextUrl.searchParams.get("status") ?? "active";
  let q = admin.supabase.from("event_registrations").select("*").eq("event_id", id).order("created_at", { ascending: true }).limit(10000);
  if (status === "active") q = q.in("status", ["confirmed", "pending_payment"]);
  else if (["confirmed", "pending_payment", "cancelled"].includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  const fields = asFormFields(event.form_fields);
  const header = ["Registration ID", "Name", "Email", "Phone", "Age", "Status", "Amount (₹)", "UTR", "Registered at (IST)", "Source", "Member", ...fields.map((f) => f.label), "Admin note"];
  const lines = [header.map(cell).join(",")];
  for (const r of (data ?? []) as EventRegistrationRow[]) {
    lines.push(
      [
        r.registration_code,
        r.full_name,
        r.email,
        r.phone,
        r.age,
        STATUS_LABEL[r.status] ?? r.status,
        r.amount,
        r.utr,
        formatDateTime(r.created_at),
        r.source === "admin" ? "Added by admin" : "Website",
        r.user_id ? "Yes" : "Guest",
        ...fields.map((f) => r.answers?.[f.id] ?? ""),
        r.admin_note,
      ]
        .map(cell)
        .join(","),
    );
  }

  const filename = `${event.slug}-participants-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
