import type { Metadata } from "next";
import { NotFound } from "@/components/ui/NotFound";

export const metadata: Metadata = { title: "Page not found — TacketPay" };

/** Any unknown URL: the app's own not-found screen (inside the sidebar layout) instead of Next's bare 404. */
export default function NotFoundPage() {
  return <NotFound title="Page not found" body="This link isn't part of TacketPay. Everything you need is on the home screen." />;
}
