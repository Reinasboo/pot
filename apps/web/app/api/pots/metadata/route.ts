import {
  getSameRequestOrigin,
  isMetadataAddress,
  isMetadataSignature,
  PotMetadataError,
  publishPotDescription,
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
      !("nonce" in body) ||
      !("signature" in body) ||
      !("description" in body) ||
      !isMetadataAddress(body.walletAddress) ||
      !isMetadataAddress(body.potAddress) ||
      typeof body.nonce !== "string" ||
      !/^[0-9a-f]{32}$/.test(body.nonce) ||
      !isMetadataSignature(body.signature) ||
      typeof body.description !== "string"
    ) {
      throw new PotMetadataError("The pot metadata update is invalid.", 400);
    }

    await publishPotDescription({
      walletAddress: body.walletAddress,
      potAddress: body.potAddress,
      nonce: body.nonce,
      signature: body.signature,
      description: body.description,
      origin,
    });
    return Response.json(
      { success: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PotMetadataError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }

    console.error(
      "Pot metadata update failed unexpectedly",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json(
      { error: "Could not save this pot’s public description." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
