// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pot } from "./Pot.sol";

contract PotFactory {
    error InvalidToken();

    IERC20 public immutable token;
    address[] private pots;
    mapping(address pot => bool registered) public isPot;

    event PotCreated(
        address indexed pot,
        address indexed organizer,
        bool targetBased,
        uint256 targetAmount,
        uint64 deadline,
        uint256 minimumContribution,
        string name,
        string metadataURI
    );

    constructor(IERC20 token_) {
        if (address(token_) == address(0) || address(token_).code.length == 0) {
            revert InvalidToken();
        }
        token = token_;
    }

    function createPot(
        string calldata name,
        string calldata metadataURI,
        bool targetBased,
        uint256 targetAmount,
        uint64 deadline,
        uint256 minimumContribution
    ) external returns (address potAddress) {
        Pot pot = new Pot(
            token,
            msg.sender,
            name,
            metadataURI,
            targetBased,
            targetAmount,
            deadline,
            minimumContribution
        );
        potAddress = address(pot);
        pots.push(potAddress);
        isPot[potAddress] = true;

        emit PotCreated(
            potAddress,
            msg.sender,
            targetBased,
            targetAmount,
            deadline,
            minimumContribution,
            name,
            metadataURI
        );
    }

    function potCount() external view returns (uint256) {
        return pots.length;
    }

    function potAt(uint256 index) external view returns (address) {
        return pots[index];
    }
}
