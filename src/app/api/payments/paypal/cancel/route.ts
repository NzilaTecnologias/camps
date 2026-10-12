import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { abandonPayPalPayment } from "@/server/registrations";

export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get("payment");
  const payment = paymentId ? await abandonPayPalPayment(paymentId) : null;
  redirect(payment ? `/registrations/${payment.registrationId}` : "/registrations");
}
