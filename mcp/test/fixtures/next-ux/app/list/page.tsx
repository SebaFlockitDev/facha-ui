import { useOrders } from "../orders/data";

export default function ListPage() {
  const orders = useOrders();
  return (
    <main>
      <h1 className="title">List</h1>
      <ul>
        {orders.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
    </main>
  );
}
