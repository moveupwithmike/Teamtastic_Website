import { requestMagicLink } from "../actions";

export default async function OfficeLogin({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-lg items-center px-5 py-16">
      <section className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-300">Private</p>
        <h1 className="mt-2 text-3xl font-bold">Teamtastic Office</h1>
        <p className="mt-3 text-slate-300">Enter your approved email. We’ll send a secure, one-time sign-in link.</p>
        {params?.sent && <p className="mt-5 rounded-xl bg-emerald-500/10 p-3 text-emerald-300">Check your inbox for the sign-in link.</p>}
        {params?.error && <p className="mt-5 rounded-xl bg-red-500/10 p-3 text-red-300">The sign-in link could not be completed. Request a fresh link and try again.</p>}
        <form action={requestMagicLink} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-300">
            Email
            <input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-purple-400" />
          </label>
          <button className="w-full rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">Email my sign-in link</button>
        </form>
      </section>
    </main>
  );
}
