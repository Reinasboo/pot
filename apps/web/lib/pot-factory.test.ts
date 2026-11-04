import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
  type Log,
} from "viem";
import {
  getConfiguredPotFactoryAddress,
  getCreatedPotAddress,
  potFactoryAbi,
} from "./pot-factory";

describe("pot factory configuration", () => {
  it("accepts and normalizes a configured address", () => {
    expect(
      getConfiguredPotFactoryAddress("0x1111111111111111111111111111111111111111"),
    ).toBe("0x1111111111111111111111111111111111111111");
  });

  it("rejects missing and malformed factory addresses", () => {
    expect(getConfiguredPotFactoryAddress("")).toBeUndefined();
    expect(getConfiguredPotFactoryAddress("not-an-address")).toBeUndefined();
  });
});

describe("PotCreated event parsing", () => {
  it("extracts the deployed pot address from a factory receipt", () => {
    const pot = "0x2222222222222222222222222222222222222222";
    const organizer = "0x3333333333333333333333333333333333333333";
    const encodedTopics = encodeEventTopics({
      abi: potFactoryAbi,
      eventName: "PotCreated",
      args: { pot, organizer },
    });
    const [eventTopic, potTopic, organizerTopic] = encodedTopics;
    if (
      typeof eventTopic !== "string" ||
      typeof potTopic !== "string" ||
      typeof organizerTopic !== "string"
    ) {
      throw new Error("Expected PotCreated topics to be encoded.");
    }
    const topics: [Hex, ...Hex[]] = [eventTopic, potTopic, organizerTopic];
    const log: Log = {
      address: "0x1111111111111111111111111111111111111111",
      blockHash: `0x${"00".repeat(32)}`,
      blockNumber: BigInt(1),
      data: encodeAbiParameters(
        [
          { type: "bool" },
          { type: "uint256" },
          { type: "uint64" },
          { type: "uint256" },
          { type: "string" },
          { type: "string" },
        ],
        [true, BigInt(25_000_000), BigInt(2_000_000_000), BigInt(1_000_000), "Trip", ""],
      ),
      logIndex: 0,
      removed: false,
      topics,
      transactionHash: `0x${"11".repeat(32)}`,
      transactionIndex: 0,
    };

    expect(getCreatedPotAddress([log])).toBe(pot);
    expect(getCreatedPotAddress([])).toBeUndefined();
  });
});
