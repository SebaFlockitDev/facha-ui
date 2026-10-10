// UX fixture: layouts that break on a phone, and the ones that adapt.
export default function WidePage({ rows }: { rows: string[] }) {
  return (
    <main className="h-screen">
      <div className="w-[800px]">Fixed</div>
      <div className="w-full max-w-[800px]">Capped</div>
      <div className="md:w-[800px]">From md up</div>
      <div className="grid grid-cols-4">Four</div>
      <div className="grid grid-cols-1 md:grid-cols-4">Adapts</div>
      <table className="table">
        <tbody>{rows.map((r) => <tr key={r}><td>{r}</td></tr>)}</tbody>
      </table>
      <div className="overflow-x-auto">
        <table className="table">
          <tbody>{rows.map((r) => <tr key={r}><td>{r}</td></tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}
