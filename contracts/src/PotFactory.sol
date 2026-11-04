// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pot } from "./Pot.sol";

contract PotFactory {
    error InvalidToken();
    error UnsupportedFundingMode();
    error InvalidCrowdfundingMode();
    error InvalidPayoutRecipient();

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
        if (!targetBased) revert UnsupportedFundingMode();
        return
            _createPot(
                name, metadataURI, 0, address(0), targetAmount, deadline, minimumContribution
            );
    }

    function createCrowdfundingPot(
        string calldata name,
        string calldata metadataURI,
        uint8 fundingMode,
        uint256 targetAmount,
        uint64 deadline,
        uint256 minimumContribution,
        address payoutRecipient
    ) external returns (address potAddress) {
        if (fundingMode != 2 && fundingMode != 3) {
            revert InvalidCrowdfundingMode();
        }
        if (payoutRecipient == address(0)) revert InvalidPayoutRecipient();
        return _createPot(
            name,
            metadataURI,
            fundingMode,
            payoutRecipient,
            targetAmount,
            deadline,
            minimumContribution
        );
    }

    function crowdfundingEnabled() external pure returns (bool) {
        return true;
    }

    function _createPot(
        string calldata name,
        string calldata metadataURI,
        uint8 fundingMode,
        address payoutRecipient,
        uint256 targetAmount,
        uint64 deadline,
        uint256 minimumContribution
    ) private returns (address potAddress) {
        Pot pot = new Pot(
            token,
            msg.sender,
            payoutRecipient,
            name,
            metadataURI,
            fundingMode,
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
            fundingMode != 1,
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
