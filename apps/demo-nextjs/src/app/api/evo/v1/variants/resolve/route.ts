import { NextResponse } from "next/server";
import { forwardApiRequest } from "../../../../../../lib/evo-api";

export async function POST(request: Request) {
  const body = await request.json();
  const response = await forwardApiRequest("/v1/variants/resolve", body, {
    fallback: {
      surfaceId: body.surfaceId ?? "pricing.hero",
      variant: "default",
      branchId: null,
      reason: "default_fallback",
      sticky: false
    }
  });

  return NextResponse.json(response.body, { status: response.status });
}
