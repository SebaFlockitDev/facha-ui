// UX fixture · flow step 3: the result, with what happened and the next step.
export default function Done() {
  return (
    <main>
      <h1 className="title">Pedido guardado</h1>
      <p role="status">Tu pedido quedó guardado.</p>
      <a href="/orders">Ver los pedidos</a>
    </main>
  );
}
