// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Pot is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidName();
    error InvalidMetadataURI();
    error InvalidTarget();
    error InvalidDeadline();
    error InvalidToken();
    error InvalidOrganizer();
    error InvalidMinimumContribution();
    error ContributionsClosed();
    error InvalidContribution();
    error GoalExceeded();
    error NotOrganizer();
    error PayoutNotEligible();
    error RefundNotEligible();
    error NoRefundAvailable();
    error RefundAlreadyClaimed();
    error UnsupportedTransferFee();

    IERC20 public immutable token;
    address public immutable organizer;
    bool public immutable targetBased;
    uint256 public immutable targetAmount;
    uint64 public immutable deadline;
    uint256 public immutable minimumContribution;
    string public name;
    string public metadataURI;

    uint256 public totalContributed;
    uint256 public totalRefunded;
    bool public paidOut;
    mapping(address contributor => uint256 amount) public contributions;
    mapping(address contributor => bool claimed) public refundsClaimed;

    event ContributionMade(address indexed contributor, uint256 amount, uint256 totalContributed);
    event PotPaidOut(address indexed organizer, uint256 amount);
    event ContributionRefunded(address indexed contributor, uint256 amount);

    constructor(
        IERC20 token_,
        address organizer_,
        string memory name_,
        string memory metadataURI_,
        bool targetBased_,
        uint256 targetAmount_,
        uint64 deadline_,
        uint256 minimumContribution_
    ) {
        if (address(token_) == address(0) || address(token_).code.length == 0) {
            revert InvalidToken();
        }
        if (organizer_ == address(0)) revert InvalidOrganizer();
        if (bytes(name_).length == 0 || bytes(name_).length > 80) revert InvalidName();
        if (bytes(metadataURI_).length > 512) revert InvalidMetadataURI();
        if (minimumContribution_ == 0) revert InvalidMinimumContribution();

        if (targetBased_) {
            if (targetAmount_ == 0) revert InvalidTarget();
            if (deadline_ <= block.timestamp) revert InvalidDeadline();
            if (minimumContribution_ > targetAmount_) revert InvalidMinimumContribution();
        } else if (targetAmount_ != 0 || deadline_ != 0) {
            revert InvalidTarget();
        }

        token = token_;
        organizer = organizer_;
        name = name_;
        metadataURI = metadataURI_;
        targetBased = targetBased_;
        targetAmount = targetAmount_;
        deadline = deadline_;
        minimumContribution = minimumContribution_;
    }

    function isContributionOpen() public view returns (bool) {
        if (paidOut) return false;
        if (!targetBased) return true;
        return block.timestamp < deadline && totalContributed < targetAmount;
    }

    function isPayoutEligible() public view returns (bool) {
        if (paidOut || totalContributed == 0) return false;
        return !targetBased || totalContributed >= targetAmount;
    }

    function isRefundEligible() public view returns (bool) {
        return
            targetBased && !paidOut && totalContributed < targetAmount
                && block.timestamp >= deadline;
    }

    function contribute(uint256 amount) external nonReentrant {
        if (!isContributionOpen()) revert ContributionsClosed();
        if (targetBased) {
            uint256 remaining = targetAmount - totalContributed;
            if (amount > remaining) revert GoalExceeded();
            if (amount < minimumContribution && amount != remaining) revert InvalidContribution();
        } else if (amount < minimumContribution) {
            revert InvalidContribution();
        }

        uint256 balanceBefore = token.balanceOf(address(this));
        contributions[msg.sender] += amount;
        totalContributed += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert UnsupportedTransferFee();

        emit ContributionMade(msg.sender, amount, totalContributed);
    }

    function payout() external nonReentrant {
        if (msg.sender != organizer) revert NotOrganizer();
        if (!isPayoutEligible()) revert PayoutNotEligible();

        paidOut = true;
        uint256 amount = totalContributed;
        token.safeTransfer(organizer, amount);

        emit PotPaidOut(organizer, amount);
    }

    function claimRefund() external nonReentrant {
        if (!isRefundEligible()) revert RefundNotEligible();

        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoRefundAvailable();
        if (refundsClaimed[msg.sender]) revert RefundAlreadyClaimed();

        refundsClaimed[msg.sender] = true;
        totalRefunded += amount;
        token.safeTransfer(msg.sender, amount);

        emit ContributionRefunded(msg.sender, amount);
    }
}
