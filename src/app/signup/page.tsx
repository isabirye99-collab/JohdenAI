import Link from "next/link";
import { signUp } from "@/app/actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-mark auth-mark">J</div>
        <p className="eyebrow">JOHDEN BUSINESS CONSULTANCY SERVICES</p>
        <h1>Create your account</h1>
        <p className="muted">Register for secure JohdenAI access.</p>
        {params.error && <p className="auth-alert error" role="alert">{params.error}</p>}
        <form action={signUp} className="auth-form">
          <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button className="primary-button auth-submit" type="submit">Create account</button>
        </form>
        <p className="auth-foot">Already registered? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
