export function Cards() {
  return (
    <section>
      <div className="rounded-lg border p-4">
        <div className="rounded-md shadow-sm p-3">Tarjeta dentro de tarjeta</div>
      </div>
      <div className="rounded-lg border p-4">
        <span className="rounded-full border">Avatar redondo</span>
      </div>
      <div className="border p-4">
        <div className="rounded-lg p-2">
          <div className="rounded-md p-1">Borde y radio en ancestros distintos</div>
        </div>
      </div>
    </section>
  );
}
