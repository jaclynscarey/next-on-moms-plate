import { setPassword } from "../../actions/auth";
export default function Password() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Make yourself at home.</h1>
        <p>Choose a password of at least 12 characters.</p>
        <form action={setPassword}>
          <label>
            New password
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="primary">Save password</button>
        </form>
      </section>
    </main>
  );
}
