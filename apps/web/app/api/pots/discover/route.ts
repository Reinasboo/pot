import { getPublicDiscoveryPots, PublicPotError } from "@/lib/public-pot";

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const pots = await getPublicDiscoveryPots(query);
    return Response.json(pots, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof PublicPotError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Public pot discovery failed unexpectedly", error);
    return Response.json({ error: "Could not load public pots." }, { status: 500 });
  }
}
