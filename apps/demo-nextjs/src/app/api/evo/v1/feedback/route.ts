import { NextResponse } from "next/server";
import { forwardApiRequest } from "../../../../../lib/evo-api";

export async function POST(request: Request) {
  const body = await request.json();
  const response = await forwardApiRequest("/v1/feedback", body);

  return NextResponse.json(response.body, { status: response.status });
}
