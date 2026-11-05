// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { PotFactory } from "../src/PotFactory.sol";

interface BroadcastVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Testnet-only deployment. Uses a local Foundry keystore through --account.
contract DeployBaseSepolia {
    BroadcastVm private constant vm =
        BroadcastVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (PotFactory factory) {
        require(block.chainid == 84532, "Only Base Sepolia is supported");
        require(USDC.code.length > 0, "USDC contract is missing");
        require(IERC20Metadata(USDC).decimals() == 6, "Unexpected USDC decimals");
        require(
            keccak256(bytes(IERC20Metadata(USDC).symbol())) == keccak256("USDC"),
            "Unexpected token symbol"
        );
        vm.startBroadcast();
        factory = new PotFactory(IERC20(USDC));
        vm.stopBroadcast();
    }
}
