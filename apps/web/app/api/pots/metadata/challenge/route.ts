import {
  createPotMetadataChallenge,
  getSameRequestOrigin,
  isMetadataAddress,
  PotMetadataError,
  readJsonBody,
} from "@/lib/pot-metadata";

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = getSameRequestOrigin(request);
    const body: unknown = await readJsonBody(request);
    if (
      typeof body !== "object" ||
      body === null ||
      !("walletAddress" in body) ||
      !("potAddress" in body) ||
      !("description" in body) ||
      !isMetadataAddress(body.walletAddress) ||
      !isMetadataAddress(body.potAddress) ||
      typeof body.description !== "string"
    ) {
      throw new PotMetadataError(
        "A valid wallet, pot address, and description are required.",
        400,
      );
    }

    const challenge = await createPotMetadataChallenge(
      body.walletAddress,
      body.potAddress,
      origin,
      body.description,
    );
    return Response.json(challenge, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PotMetadataError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }

    console.error(
      "Pot metadata challenge failed unexpectedly",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json(
      { error: "Could not authorize this pot description update." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
