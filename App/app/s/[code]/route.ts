import { redirect, RedirectType, notFound } from "next/navigation";
import { API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Short tracking links live on the frontend host: /s/{code}. The code is the
 * first 8 hex chars of an order id (shortTrackCode in the backend). This
 * handler asks the backend to resolve the code, then 307s to the live order
 * page — so the link a customer receives works on whatever host serves the
 * frontend, with no custom domain or URL shortener needed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!/^[0-9a-fA-F]{8}$/.test(code)) notFound();

  let res: Response;
  try {
    res = await fetch(`${API_URL}/public/track/${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
  } catch {
    notFound();
  }
  if (!res.ok) notFound();

  const data = (await res.json()) as { order_id?: string };
  if (!data.order_id) notFound();

  redirect(`/order/${data.order_id}`, RedirectType.replace);
}
