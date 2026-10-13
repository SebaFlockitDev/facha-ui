import { useNavigate } from "react-router-dom";
import { useOrders } from "../lib/orders.tsx";

export default function Orders() {
  const { orders } = useOrders();
  const navigate = useNavigate();
  return (
    <main className="page">
      <h1 className="title">Pedidos</h1>
      <table className="table">
        <thead>
          <tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
              <td>#{o.id}</td><td>{o.customer}</td><td>$ {o.total}</td><td><span className="chip">{o.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
