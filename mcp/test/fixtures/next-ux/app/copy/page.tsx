// UX fixture: microcopy that says nothing, and copy that helps.
export default function CopyPage() {
  return (
    <main>
      <h1 className="title">Pedidos</h1>
      <a href="/orders/1">Click aquí</a>
      <button className="btn-primary">OK</button>
      <p role="alert">Ocurrió un error</p>
      <p>Error 500: Internal Server Error</p>
      <p>IMPORTE TOTAL DEL MES</p>
      <p>Tu orden quedó registrada.</p>
      <p>Puedes descargar el recibo.</p>
      <label>
        Email <input placeholder="Ingresa tu email" />
      </label>
      <a href="/orders/1">Ver el detalle del pedido</a>
      <button className="btn-primary">Guardar pedido</button>
      <p role="alert">No pudimos guardar el pedido. Revisá tu conexión y probá de nuevo.</p>
      <p>Podés descargar el recibo. Ingresá tu email para recibirlo.</p>
      <abbr title="Impuesto al valor agregado">IVA</abbr>
      <p className="caption">Ordenar por fecha</p>
    </main>
  );
}
