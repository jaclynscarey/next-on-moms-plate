"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Something didn’t load.</h1>
        <p>
          Your saved requests are still there. Try refreshing the dashboard.
        </p>
        <button className="primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
