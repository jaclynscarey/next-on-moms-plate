import { deliverNotifications } from "@/lib/notifications";
export async function POST(request: Request) {
  if (
    !process.env.NOTIFICATION_SECRET ||
    request.headers.get("authorization") !==
      `Bearer ${process.env.NOTIFICATION_SECRET}`
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await deliverNotifications(20));
}
