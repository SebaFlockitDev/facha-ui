// UX fixture · flow step 2: "Grabar" for the same action, and a delete with no confirmation.
export default function ReviewOrder({ store, drop }: { store: () => void; drop: () => void }) {
  return (
    <main>
      <h1 className="title">Revisar pedido</h1>
      <button className="btn-primary" onClick={store}>Grabar cambios</button>
      <button className="btn-secondary" onClick={drop}>Eliminar pedido</button>
      <a href="/orders">Volver</a>
    </main>
  );
}
