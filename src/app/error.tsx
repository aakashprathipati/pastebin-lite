"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="message-page"><p className="eyebrow">A SMALL INTERRUPTION</p><h1>Couldn’t load<br />this paste.</h1><p>Please try again in a moment.</p><button className="primary" onClick={reset}>Try again ↗</button></section>;
}
