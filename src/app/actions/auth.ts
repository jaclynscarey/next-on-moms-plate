"use server";
import { db } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { orderDestination } from "@/lib/links";
export async function signIn(form: FormData) {
  const client = await db();
  const { error } = await client.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  const order = String(form.get("order") ?? "");
  if (error)
    redirect(
      "/login?error=signin" +
        (orderDestination(order) !== "/"
          ? "&order=" + encodeURIComponent(order)
          : ""),
    );
  redirect(orderDestination(order));
}
export async function signOut() {
  const client = await db();
  await client.auth.signOut();
  redirect("/login");
}
export async function recover(form: FormData) {
  const client = await db();
  await client.auth.resetPasswordForEmail(String(form.get("email")), {
    redirectTo: `${process.env.APP_URL}/auth/callback?next=/auth/password`,
  });
  redirect("/login?message=recovery");
}
export async function setPassword(form: FormData) {
  const password = String(form.get("password"));
  if (password.length < 12) redirect("/auth/password?error=length");
  const client = await db();
  const { error } = await client.auth.updateUser({ password });
  if (error) redirect("/login?error=session");
  redirect("/");
}
