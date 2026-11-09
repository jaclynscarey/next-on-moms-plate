import { signIn, recover } from "../actions/auth";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  return (
    <main className="auth-page">
      <a href="/" className="wordmark">
        Next on Mom’s Plate
      </a>
      <section className="auth-card">
        <span className="eyebrow">FAMILY PRINT SHOP</span>
        <h1>Welcome back.</h1>
        <p>Sign in to put something on Mom’s plate.</p>
        {p.error && (
          <p role="alert">
            We couldn’t sign you in. Check your details or request a new
            recovery email.
          </p>
        )}
        {p.message && (
          <p role="status">
            If that email has an account, a recovery link is on its way.
          </p>
        )}
        <form action={signIn}>
          <input type="hidden" name="order" value={p.order ?? ""} />
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary">Sign in</button>
        </form>
        <details>
          <summary>Forgot your password?</summary>
          <form action={recover}>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <button>Send recovery link</button>
          </form>
        </details>
        <small>By invitation only. Ask Mom for an invitation.</small>
      </section>
    </main>
  );
}
