const orders = [{ id: "1048", status: "paid", label: "Pagado" }];

export default function OrdersPage() {
  return (
    <main>
      <table>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>
                <span className="dot dot-paid" />
              </td>
              <td>
                <span className={`dot dot-${o.status}`} />
              </td>
              <td>
                <span className="bg-success dot" />
              </td>
              <td>
                <span className="dot dot-paid" /> Pagado
              </td>
              <td>
                <span className="dot dot-overdue" aria-label="Vencido" />
              </td>
              <td>
                <span className="dot dot-overdue" aria-hidden="true" />
              </td>
              <td>
                <span className="dot dot-paid">
                  <svg viewBox="0 0 8 8" />
                </span>
              </td>
              <td>
                <span className={`chip chip-${o.status}`}>{o.label}</span>
              </td>
              <td>
                <span className="dot dot-paid">
                  <span className="sr-only">Pagado</span>
                </span>
              </td>
              <td>
                <button className="dot-overdue" aria-label="Ver vencidos" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
