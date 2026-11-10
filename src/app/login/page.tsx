import Link from "next/link";
import { signIn } from "@/app/actions";

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-mark auth-mark">J</div>
        <p className="eyebrow">JOHDEN BUSINESS CONSULTANCY SERVICES</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your JohdenAI workspace.</p>
        {params.error && <p className="auth-alert error" role="alert">{params.error}</p>}
        {params.message && <p className="auth-alert success" role="status">{params.message}</p>}
        <form action={signIn} className="auth-form">
          <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="primary-button auth-submit" type="submit">Sign in</button>
        </form>
        <p className="auth-foot">New to JohdenAI? <Link href="/signup">Create an account</Link></p>
      </section>
    </main>
  );
}
