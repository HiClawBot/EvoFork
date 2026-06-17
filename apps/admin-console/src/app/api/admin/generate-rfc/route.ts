import { NextResponse } from "next/server";
import { generateDemoRfc } from "../../../../lib/demo-flow";

export async function POST() {
  const rfc = await generateDemoRfc();

  return NextResponse.json({
    ok: true,
    rfc
  });
}
