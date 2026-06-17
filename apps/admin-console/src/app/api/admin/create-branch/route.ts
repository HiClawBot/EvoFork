import { NextResponse } from "next/server";
import { createDemoBranch } from "../../../../lib/demo-flow";

export async function POST() {
  return NextResponse.json(await createDemoBranch());
}
