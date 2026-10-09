export default function Page() {
  return (
    <main className="bg-panel p-4">
      <h1 className="text-slate-900">Orders</h1>
      <button className="bg-blue-600 hover:bg-blue-700 border-red-500/50">Save</button>
      <p className="text-gray-500 bg-transparent">Mapped in @theme</p>
      <p className="text-white">Project class with a palette name</p>
      <span className="text-zinc-400">Zinc</span>
      <div className="rounded-md shadow-md text-sm tracking-wide leading-tight">Default scales</div>
      <div className="rounded-full shadow-none font-bold p-4 w-full leading-6 tracking-normal">Accepted by default</div>
      <div className="rounded-lg text-xs/5 md:rounded-xl">Mapped and nearest</div>
    </main>
  );
}
