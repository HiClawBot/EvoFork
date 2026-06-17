import { NextResponse } from "next/server";
import { getAdminSnapshot } from "../../../../lib/admin-api";

export async function GET() {
  return NextResponse.json(await getAdminSnapshot());
}
