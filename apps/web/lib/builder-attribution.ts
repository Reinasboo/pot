import { Attribution } from "ox/erc8021";

export function getBuilderDataSuffix(builderCode = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE) {
  const normalizedCode = builderCode?.trim();
  return normalizedCode ? Attribution.toDataSuffix({ codes: [normalizedCode] }) : undefined;
}

export function requireBuilderDataSuffix(builderCode = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE) {
  const suffix = getBuilderDataSuffix(builderCode);
  if (!suffix) {
    throw new Error(
      "Base transactions are disabled until NEXT_PUBLIC_BASE_BUILDER_CODE is configured.",
    );
  }
  return suffix;
}
