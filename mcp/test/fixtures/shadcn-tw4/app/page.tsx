export default function OrdersPage() {
  return (
    <main className="bg-background text-foreground">
      <h1>Pedidos</h1>
      <p className="text-muted-foreground">4 pedidos esperan revisión.</p>
      <button className="bg-primary text-primary-foreground rounded-md">Revisar pedidos</button>
      <p className="text-[#1e293b]">Actualizado hace un minuto</p>
    </main>
  );
}
