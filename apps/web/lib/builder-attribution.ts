import { Attribution } from "ox/erc8021";

export function getBuilderDataSuffix(builderCode = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE) {
  const normalizedCode = builderCode?.trim();
  if (!normalizedCode || new TextEncoder().encode(normalizedCode).length > 255) return undefined;
  return Attribution.toDataSuffix({ codes: [normalizedCode] });
}

export function requireBuilderDataSuffix(builderCode = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE) {
  const suffix = getBuilderDataSuffix(builderCode);
  if (!suffix) {
    throw new Error(
      "Base transactions are disabled until NEXT_PUBLIC_BASE_BUILDER_CODE contains a valid Builder Code of 255 bytes or fewer.",
    );
  }
  return suffix;
}
