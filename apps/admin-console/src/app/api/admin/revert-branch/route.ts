import { NextResponse } from "next/server";
import { postApiJson } from "../../../../lib/admin-api";

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

  const response = await postApiJson(`/v1/branches/${body.id}/revert`, {
    reason: "Demo rollback requested from admin console.",
    actor: "maintainer"
  });

  return NextResponse.json({
    ok: response.status < 400,
    action: "revert_branch",
    response: response.body
  });
}
