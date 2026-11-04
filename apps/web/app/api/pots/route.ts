import { getPublicOrganizerPots, PublicPotError } from "@/lib/public-pot";

export async function GET(request: Request): Promise<Response> {
  const organizer = new URL(request.url).searchParams.get("organizer");
  if (!organizer) {
    return Response.json({ error: "A wallet address is required." }, { status: 400 });
  }

  try {
    const pots = await getPublicOrganizerPots(organizer);
    return Response.json(pots, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof PublicPotError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("Organizer pot query failed unexpectedly", error);
    return Response.json({ error: "Could not load pots for this wallet." }, { status: 500 });
  }
}
