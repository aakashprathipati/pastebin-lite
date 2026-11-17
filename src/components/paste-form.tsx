"use client";

import { useRef, useState, type FormEvent } from "react";

export default function PasteForm() {
  const [content, setContent] = useState("");
  const [ttl, setTtl] = useState("");
  const [maxViews, setMaxViews] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const submitting = useRef(false);
  const linkInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(""); setUrl(""); setCopied(false);
    if (!content.trim()) { setError("Enter paste content."); return; }
    const payload: { content: string; ttl_seconds?: number; max_views?: number } = { content };
    for (const [field, value] of [["ttl_seconds", ttl], ["max_views", maxViews]] as const) {
      if (!value) continue;
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < 1) {
        setError("Expiration and view limit must be whole numbers of at least 1."); return;
      }
      payload[field] = number;
    }
    submitting.current = true; setPending(true);
    try {
      const response = await fetch("/api/pastes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create paste.");
      setUrl(result.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect. Please try again.");
    } finally { submitting.current = false; setPending(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { linkInput.current?.focus(); linkInput.current?.select(); setError("Select and copy the link manually."); }
  }

  return <section className="composer" aria-labelledby="composer-title">
    <form onSubmit={submit}>
      <div className="composer-heading"><h2 id="composer-title">Create paste</h2><span className="badge">PLAIN TEXT</span></div>
      <label className="sr-only" htmlFor="content">Paste content</label>
      <textarea id="content" name="content" required placeholder="Enter or paste your text here." value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} disabled={pending} />
      <div className="editor-bottom"><span>Plain text only.</span><span>{content.length.toLocaleString()} characters</span></div>
      <div className="options">
        <div><label htmlFor="ttl">Expires after <span>optional</span></label><div className="input-unit"><input id="ttl" name="ttl_seconds" type="number" min="1" step="1" placeholder="No expiration" value={ttl} onChange={(event) => setTtl(event.target.value)} disabled={pending} /><span>seconds</span></div></div>
        <div><label htmlFor="max-views">View limit <span>optional</span></label><div className="input-unit"><input id="max-views" name="max_views" type="number" min="1" step="1" placeholder="Unlimited" value={maxViews} onChange={(event) => setMaxViews(event.target.value)} disabled={pending} /><span>views</span></div></div>
      </div>
      <button className="primary" type="submit" disabled={pending}>{pending ? "Creating paste..." : "Create paste"}<span aria-hidden="true">↗</span></button>
      <p className="form-note">Anyone with the link can read your paste.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {url && <div className="result" role="status"><h3>Paste created</h3><p>Copy the link to share this paste. Opening it counts as one view.</p><label className="sr-only" htmlFor="share-url">Shareable paste link</label><div className="share-row"><input ref={linkInput} id="share-url" readOnly value={url} onFocus={(event) => event.target.select()} /><button type="button" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button></div><a href={url}>Open paste ↗</a></div>}
    </form>
  </section>;
}
