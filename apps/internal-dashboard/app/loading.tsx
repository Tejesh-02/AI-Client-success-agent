export default function Loading() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 flex-shrink-0 border-r border-slate-200 bg-white">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-slate-200 p-4">
            <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-1 h-3 w-20 animate-pulse rounded bg-slate-100" />
          </div>
          <nav className="flex-1 space-y-1 p-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </nav>
          <div className="border-t border-slate-200 p-3">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6 h-7 w-32 animate-pulse rounded bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="mt-8 space-y-4">
            <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      </main>
    </div>
  );
}
