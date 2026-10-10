// UX fixture · flow step 1: a form with no way out, no feedback and no error state.
export default function NewOrder({ save }: { save: () => void }) {
  return (
    <main>
      <h1 className="title">Nuevo pedido</h1>
      <form onSubmit={save}>
        <label>
          Cliente <input />
        </label>
        <button type="submit" className="btn-primary">Guardar pedido</button>
      </form>
    </main>
  );
}
