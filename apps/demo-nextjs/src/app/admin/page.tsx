import Link from "next/link";

export default function AdminShortcutPage() {
  return (
    <main className="shell narrow">
      <nav className="topbar" aria-label="Demo navigation">
        <span className="brand">EvoFork Demo</span>
        <Link href="/pricing">Pricing</Link>
      </nav>
      <section className="intro">
        <p className="eyebrow">Admin Console</p>
        <h1>Use the dedicated admin app on port 3001.</h1>
        <p>
          Run `pnpm dev` from the repository root, then open the admin console to view
          feedback, generate the RFC, create the branch, and revert it.
        </p>
        <a className="button primary" href="http://127.0.0.1:3001">
          Open Admin Console
        </a>
      </section>
    </main>
  );
}
