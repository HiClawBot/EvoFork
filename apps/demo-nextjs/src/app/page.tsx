import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell narrow">
      <nav className="topbar" aria-label="Demo navigation">
        <span className="brand">EvoFork Demo</span>
        <Link href="/pricing">Pricing</Link>
        <Link href="/admin">Admin</Link>
      </nav>
      <section className="intro">
        <p className="eyebrow">Developer Preview</p>
        <h1>Feedback to fork, running locally.</h1>
        <p>
          Open the pricing page, submit confusion feedback, generate the RFC from the
          admin console, create a branch, and route a new-user segment to the fork.
        </p>
        <div className="actions">
          <Link className="button primary" href="/pricing">
            Open Pricing
          </Link>
          <Link className="button" href="/admin">
            Open Admin
          </Link>
        </div>
      </section>
    </main>
  );
}
