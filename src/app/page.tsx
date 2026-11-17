import PasteForm from "@/components/paste-form";

export default function HomePage() {
  return <div className="home-grid">
    <section className="intro"><p className="eyebrow">A QUICK THOUGHT. A CODE SNIPPET. A NOTE.</p>
      <h1>Put it here.<br />Pass it <em>on.</em></h1>
      <p className="intro-copy">Give your text a link. Add a little privacy with an expiration time or a view limit, and share it wherever you need.</p>
      <div className="intro-bottom"><span className="spark" aria-hidden="true">✳</span><p>No account. No extra steps.<br /><strong>Just write, create, and share.</strong></p></div>
    </section>
    <PasteForm />
  </div>;
}
