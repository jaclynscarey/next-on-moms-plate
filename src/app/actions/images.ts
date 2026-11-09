"use server";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
export async function uploadReferences(orderId: string, form: FormData) {
  const user = await requireMember();
  const client = await db();
  const { data: order } = await client
    .from("orders")
    .select("submitter_id,status,version")
    .eq("id", orderId)
    .single();
  if (
    !order ||
    order.submitter_id !== user.id ||
    !["pending", "changes_requested"].includes(order.status)
  )
    throw Error(
      "References can be added to your request while it is awaiting review.",
    );
  const files = form
    .getAll("images")
    .filter((x): x is File => x instanceof File && x.size > 0);
  const { count } = await client
    .from("order_images")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);
  if (files.length + (count ?? 0) > 5)
    throw Error("An order can have up to five images.");
  const checked = [];
  if (files.reduce((sum, f) => sum + f.size, 0) > 3 * 1024 * 1024)
    throw Error("Reference images must total under 3 MB.");
  for (const file of files) {
    if (file.size > 3 * 1024 * 1024)
      throw Error("Each image must be smaller than 3 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const type =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? "image/jpeg"
        : bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP"
            ? "image/webp"
            : null;
    if (!type || type !== file.type)
      throw Error("Upload a JPEG, PNG, or WebP image.");
    checked.push({ bytes, type });
  }
  const admin = adminDb();
  const paths: string[] = [];
  try {
    for (const file of checked) {
      const path = `${orderId}/${crypto.randomUUID()}`;
      const { error } = await admin.storage
        .from("references")
        .upload(path, file.bytes, { contentType: file.type });
      if (error)
        throw Error("Image upload failed. Your order is saved; try again.");
      paths.push(path);
    }
    const { error } = await admin.rpc("attach_order_images", {
      oid: orderId,
      expected_version: order.version,
      actor_id: user.id,
      paths,
    });
    if (error) throw Error(error.message);
  } catch (error) {
    if (paths.length) await admin.storage.from("references").remove(paths);
    throw error;
  }
  revalidatePath("/");
}
