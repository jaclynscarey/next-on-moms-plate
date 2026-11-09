import { db } from "./supabase/server";
export async function requireMember() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw Error("Please sign in.");
  const { data, error } = await client
    .from("profiles")
    .select("id,name,role")
    .eq("id", user.id)
    .single();
  if (error || !data) throw Error("An invitation is required.");
  return data as { id: string; name: string; role: "admin" | "member" };
}
export async function requireAdmin() {
  const member = await requireMember();
  if (member.role !== "admin") throw Error("Admin access required.");
  return member;
}
