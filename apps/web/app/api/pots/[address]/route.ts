import { getPublicPot, PublicPotError } from "@/lib/public-pot";

export async function GET(
  request: Request,
  context: RouteContext<"/api/pots/[address]">,
): Promise<Response> {
  const { address } = await context.params;

  try {
    const pot = await getPublicPot(address, request.headers.get("x-pot-access-key"));
    return Response.json(pot, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof PublicPotError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "cache-control": "private, no-store" } },
      );
    }

    console.error("Public pot query failed unexpectedly", error);
    return Response.json({ error: "Could not load this pot." }, { status: 500 });
  }
}
