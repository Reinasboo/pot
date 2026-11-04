import {
  CommunityError,
  createCommunityChallenge,
  getCommunityRequestOrigin,
} from "@/lib/community";
import { PotMetadataError, readJsonBody } from "@/lib/pot-metadata";

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = getCommunityRequestOrigin(request);
    const body = await readJsonBody(request);
    const challenge = await createCommunityChallenge(body, origin);
    return Response.json(challenge, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof CommunityError || error instanceof PotMetadataError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
    console.error("Community authorization challenge failed", error);
    return Response.json(
      { error: "Could not authorize this community action." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
