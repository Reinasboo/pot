import {
  CommunityError,
  getPotCommunity,
  isCommunityAddress,
} from "@/lib/community";

export async function GET(
  request: Request,
  context: { params: Promise<{ address: string }> },
): Promise<Response> {
  try {
    const { address } = await context.params;
    const wallet = new URL(request.url).searchParams.get("wallet") ?? undefined;
    if (wallet && !isCommunityAddress(wallet)) {
      throw new CommunityError("This wallet address is not valid.", 400);
    }
    const community = await getPotCommunity(address, wallet);
    return Response.json(community, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof CommunityError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Pot community query failed unexpectedly", error);
    return Response.json({ error: "Could not load this pot’s community activity." }, { status: 500 });
  }
}
