function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center px-6">
      <section className="max-w-2xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Tavus Demo
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          Benvenuto su{' '}
          <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
            Tavus Demo
          </span>
        </h1>

        <p className="text-lg text-slate-300">
          Progetto React inizializzato con Vite, TypeScript e Tailwind CSS.
          Pronto per iniziare a costruire qualcosa di straordinario.
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <a
            href="https://vite.dev"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/20"
          >
            Vite
          </a>
          <a
            href="https://react.dev"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/20"
          >
            React
          </a>
          <a
            href="https://tailwindcss.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/20"
          >
            Tailwind CSS
          </a>
        </div>

        <p className="pt-8 text-sm text-slate-500">
          Modifica <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">src/App.tsx</code> per iniziare.
        </p>
      </section>
    </main>
  )
}

export default App
