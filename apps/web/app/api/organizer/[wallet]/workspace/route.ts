import {
  CommunityError,
  getOrganizerWorkspace,
  isCommunityAddress,
} from "@/lib/community";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> },
): Promise<Response> {
  try {
    const { wallet } = await context.params;
    if (!isCommunityAddress(wallet)) {
      throw new CommunityError("A valid wallet address is required.", 400);
    }
    const workspace = await getOrganizerWorkspace(wallet);
    return Response.json(workspace, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof CommunityError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Organizer workspace query failed unexpectedly", error);
    return Response.json({ error: "Could not load organizer tools." }, { status: 500 });
  }
}
