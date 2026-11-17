import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAndConsumePaste, getCurrentTimeMs } from "@/lib/pastes";

export const dynamic = "force-dynamic";

export default async function PastePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestHeaders = await headers();
  // The URL is irrelevant to the clock helper; no internal HTTP request is made.
  const clockRequest = new Request("https://clock.invalid", { headers: requestHeaders });
  const paste = await getAndConsumePaste(id, getCurrentTimeMs(clockRequest), true);
  if (!paste) notFound();

  return <article className="paste-view">
    <p className="eyebrow">SHARED PASTE</p>
    <div className="paste-heading"><h1>Paste content</h1><a className="text-link" href="/">Create paste ↗</a></div>
    <div className="paste-meta"><span>{paste.remaining_views === null ? "Unlimited views" : `${paste.remaining_views} views remaining`}</span><span>{paste.expires_at ? `Expires ${paste.expires_at}` : "No expiration"}</span></div>
    <pre className="paste-content">{paste.content}</pre>
  </article>;
}
