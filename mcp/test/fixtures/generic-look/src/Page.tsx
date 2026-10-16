export default function Page() {
  return (
    <main>
      <div className="bg-indigo-600 text-gray-500">Gris sobre índigo</div>
      <div className="bg-indigo-600 text-white">Blanco sobre índigo</div>
      <div className="bg-indigo-600 hover:text-gray-500 text-white">Hover no cuenta</div>
      <section className="bg-gradient-to-r from-indigo-600 to-violet-100 text-white">Degradado que falla</section>
      <section className="bg-gradient-to-r from-indigo-900 to-indigo-700 text-white">Degradado que pasa</section>
      <span className="animate-spin" aria-hidden="true" />
      <span className="motion-safe:animate-spin" aria-hidden="true" />
      <span className="animate-pulse motion-reduce:animate-none" aria-hidden="true" />
    </main>
  );
}
