import { getPublicPot, PublicPotError } from "@/lib/public-pot";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/pots/[address]">,
): Promise<Response> {
  const { address } = await context.params;

  try {
    const pot = await getPublicPot(address);
    return Response.json(pot, {
      headers: {
        "cache-control": "public, max-age=0, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    if (error instanceof PublicPotError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("Public pot query failed unexpectedly", error);
    return Response.json({ error: "Could not load this pot." }, { status: 500 });
  }
}
