import {
  applyCommunityAction,
  CommunityError,
  getCommunityRequestOrigin,
} from "@/lib/community";
import { PotMetadataError, readJsonBody } from "@/lib/pot-metadata";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = getCommunityRequestOrigin(request);
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      throw new CommunityError("The signed action is invalid.", 400);
    }
    const result = await applyCommunityAction({
      action: body.action,
      nonce: body.nonce,
      signature: body.signature,
      origin,
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof CommunityError || error instanceof PotMetadataError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
    console.error("Community action failed unexpectedly", error);
    return Response.json(
      { error: "Could not save this community action." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
