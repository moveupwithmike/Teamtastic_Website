export default function PolicyShell({ eyebrow = "Teamtastic", title, updated, children }) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-14 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-400">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: {updated}</p>
        <div className="mt-10 space-y-12">{children}</div>
      </div>
    </main>
  );
}

export function PolicySection({ title, children }) {
  return (
    <section>
      <h2 className="text-2xl font-extrabold tracking-tight text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300 sm:text-base">{children}</div>
    </section>
  );
}