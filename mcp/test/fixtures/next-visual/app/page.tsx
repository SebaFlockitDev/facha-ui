export default function Page() {
  return (
    <main>
      <h1 className="title">Orders</h1>
      <p className="muted">Readable in both themes</p>
      <p className="notice">Overridden in dark</p>
      <a className="sidebar-link">Sits on a dark sidebar</a>
      <span style={{ color: "var(--title)" }}>Inline title</span>
      <svg>
        <path fill="var(--border)" />
        <path stroke="var(--primary)" />
      </svg>
    </main>
  );
}
