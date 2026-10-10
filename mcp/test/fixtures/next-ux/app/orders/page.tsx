// UX fixture: a screen with accessibility problems and a hierarchy that competes.
export default function OrdersPage({ orders }: { orders: { id: number; name: string }[] }) {
  return (
    <main>
      <h1 className="title">Orders</h1>
      <h3 className="caption">Pending</h3>
      <img src="/chart.png" />
      <input placeholder="Search" />
      <button className="btn-primary h-4 w-4" />
      <div onClick={() => alert("open")}>Open</div>
      <span tabIndex={2}>Skip</span>
      <button className="btn-primary outline-none">Approve</button>
      <button className="btn-primary">Reject</button>
      <span className="badge flag text-[13px] text-sm">New</span>
      <p className="body caption">{orders.length}</p>
    </main>
  );
}
