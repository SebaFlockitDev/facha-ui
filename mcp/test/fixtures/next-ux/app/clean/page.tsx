// UX fixture: the same needs, solved; it handles loading, empty and error states.
import Image from "next/image";

export default function CleanPage({ loading, error, orders }: { loading: boolean; error: string | null; orders: string[] }) {
  if (loading) return <p aria-busy="true">Loading…</p>;
  if (error) return <p role="alert">{error}</p>;
  return (
    <main>
      <h1 className="title">Orders</h1>
      <h2 className="body">Pending</h2>
      <Image src="/chart.png" alt="Orders per week" width={320} height={160} />
      <Image src="/divider.png" alt="" width={320} height={2} />
      <label>
        Search <input />
      </label>
      <label htmlFor="status">Status</label>
      <select id="status" />
      <button className="btn-secondary p-2 h-4 w-4" aria-label="Refresh">
        <svg aria-hidden="true" />
      </button>
      <button className="btn-primary">Approve</button>
      <button className="btn-secondary focus-visible:ring-2 outline-none">Reject</button>
      <div role="button" tabIndex={0} onClick={() => undefined} onKeyDown={() => undefined}>Open</div>
      <div role="dialog" aria-modal="true" onClick={() => undefined} />
      {orders.length === 0 ? <p className="caption">No orders yet.</p> : null}
    </main>
  );
}
