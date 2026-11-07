import { redirect } from "next/navigation";

/** /admin → the events dashboard (the only admin module now). */
export default function AdminIndex() {
  redirect("/admin/events");
}
