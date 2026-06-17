import { NextResponse } from "next/server";
import { revertDemoBranch } from "../../../../lib/demo-flow";

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string };

  if (!body.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing branch id"
      },
      { status: 400 }
    );
  }

  return NextResponse.json(await revertDemoBranch(body.id));
}
