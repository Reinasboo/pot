import {
  CommunityError,
  getPublicOrganizerProfile,
} from "@/lib/community";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> },
): Promise<Response> {
  try {
    const { wallet } = await context.params;
    const profile = await getPublicOrganizerProfile(wallet);
    return Response.json(profile, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof CommunityError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Organizer profile query failed unexpectedly", error);
    return Response.json({ error: "Could not load this organizer’s page." }, { status: 500 });
  }
}
