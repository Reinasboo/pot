// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Pot } from "../src/Pot.sol";
import { PotFactory } from "../src/PotFactory.sol";

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function warp(uint256 timestamp) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
}

contract MockUSDC is ERC20 {
    error TransfersDisabled();

    bool public transfersDisabled;

    constructor() ERC20("Mock USDC", "mUSDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setTransfersDisabled(bool disabled) external {
        transfersDisabled = disabled;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (transfersDisabled) revert TransfersDisabled();
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value)
        public
        virtual
        override
        returns (bool)
    {
        if (transfersDisabled) revert TransfersDisabled();
        return super.transferFrom(from, to, value);
    }
}

contract PotTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant UNIT = 1e6;
    address private constant ORGANIZER = address(0xA11CE);
    address private constant ALICE = address(0xB0B);
    address private constant BOB = address(0xB0C);
    uint64 private constant DEADLINE = 2_000_000_000;

    MockUSDC private token;
    PotFactory private factory;

    function setUp() public {
        token = new MockUSDC();
        factory = new PotFactory(IERC20(address(token)));
        token.mint(ALICE, 100 * UNIT);
        token.mint(BOB, 100 * UNIT);
    }

    function testCreatesFlexiblePotWithExplicitNoDeadlineRules() public {
        Pot pot = _createPot(false, 0, 0, UNIT);

        _assertEq(pot.organizer(), ORGANIZER);
        _assertFalse(pot.targetBased());
        _assertEq(pot.deadline(), 0);
        _assertTrue(factory.isPot(address(pot)));
        _assertEq(factory.potCount(), 1);
        _assertEq(factory.potAt(0), address(pot));
    }

    function testCreatesTargetPot() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);

        _assertTrue(pot.targetBased());
        _assertEq(pot.targetAmount(), 10 * UNIT);
        _assertEq(pot.deadline(), DEADLINE);
    }

    function testRejectsEmptyName() public {
        vm.expectRevert(Pot.InvalidName.selector);
        _create("", true, 10 * UNIT, DEADLINE, UNIT);
    }

    function testRejectsZeroTarget() public {
        vm.expectRevert(Pot.InvalidTarget.selector);
        _create("Trip", true, 0, DEADLINE, UNIT);
    }

    function testRejectsTargetDeadlineInPastOrNow() public {
        vm.warp(DEADLINE);
        vm.expectRevert(Pot.InvalidDeadline.selector);
        _create("Trip", true, 10 * UNIT, DEADLINE, UNIT);
    }

    function testRejectsDeadlineOnFlexiblePot() public {
        vm.expectRevert(Pot.InvalidTarget.selector);
        _create("Gift", false, 0, DEADLINE, UNIT);
    }

    function testRejectsZeroMinimumContribution() public {
        vm.expectRevert(Pot.InvalidMinimumContribution.selector);
        _create("Trip", true, 10 * UNIT, DEADLINE, 0);
    }

    function testRejectsMinimumContributionAboveTarget() public {
        vm.expectRevert(Pot.InvalidMinimumContribution.selector);
        _create("Trip", true, UNIT, DEADLINE, 2 * UNIT);
    }

    function testAcceptsContributionAndTracksIt() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, 3 * UNIT);

        _assertEq(pot.contributions(ALICE), 3 * UNIT);
        _assertEq(pot.totalContributed(), 3 * UNIT);
        _assertEq(token.balanceOf(address(pot)), 3 * UNIT);
    }

    function testAggregatesMultipleContributionsFromSameContributor() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, 2 * UNIT);
        _contribute(pot, ALICE, 3 * UNIT);

        _assertEq(pot.contributions(ALICE), 5 * UNIT);
        _assertEq(pot.totalContributed(), 5 * UNIT);
    }

    function testRejectsZeroOrBelowMinimumContribution() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        vm.startPrank(ALICE);
        token.approve(address(pot), type(uint256).max);
        vm.expectRevert(Pot.InvalidContribution.selector);
        pot.contribute(0);
        vm.expectRevert(Pot.InvalidContribution.selector);
        pot.contribute(UNIT - 1);
        vm.stopPrank();
    }

    function testConfiguredTokenIsRequired() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        MockUSDC wrongToken = new MockUSDC();
        wrongToken.mint(ALICE, 10 * UNIT);

        vm.startPrank(ALICE);
        wrongToken.approve(address(pot), type(uint256).max);
        vm.expectRevert();
        pot.contribute(UNIT);
        vm.stopPrank();

        _assertEq(pot.totalContributed(), 0);
    }

    function testRejectsContributionAfterTargetReached() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, 10 * UNIT);

        vm.startPrank(BOB);
        token.approve(address(pot), type(uint256).max);
        vm.expectRevert(Pot.ContributionsClosed.selector);
        pot.contribute(UNIT);
        vm.stopPrank();
    }

    function testRejectsContributionThatExceedsTarget() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        vm.startPrank(ALICE);
        token.approve(address(pot), type(uint256).max);
        vm.expectRevert(Pot.GoalExceeded.selector);
        pot.contribute(11 * UNIT);
        vm.stopPrank();
    }

    function testAllowsBelowMinimumContributionForExactTargetRemainder() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, 6 * UNIT);
        _contribute(pot, ALICE, 6 * UNIT);
        _contribute(pot, BOB, 4 * UNIT);

        _assertEq(pot.totalContributed(), 10 * UNIT);
        _assertFalse(pot.isContributionOpen());
    }

    function testRejectsContributionAtDeadline() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        vm.warp(DEADLINE);

        vm.startPrank(ALICE);
        token.approve(address(pot), type(uint256).max);
        vm.expectRevert(Pot.ContributionsClosed.selector);
        pot.contribute(UNIT);
        vm.stopPrank();
    }

    function testFlexiblePotAcceptsContributionsWithoutDeadline() public {
        Pot pot = _createPot(false, 0, 0, UNIT);
        vm.warp(uint256(DEADLINE) + 10_000_000);
        _contribute(pot, ALICE, UNIT);

        _assertEq(pot.totalContributed(), UNIT);
    }

    function testPayoutCannotHappenBeforeEligibility() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);

        vm.prank(ORGANIZER);
        vm.expectRevert(Pot.PayoutNotEligible.selector);
        pot.payout();
    }

    function testOnlyOrganizerCanPayout() public {
        Pot pot = _createPot(false, 0, 0, UNIT);
        _contribute(pot, ALICE, UNIT);

        vm.prank(ALICE);
        vm.expectRevert(Pot.NotOrganizer.selector);
        pot.payout();
    }

    function testTargetPotPayoutAfterExactGoal() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, 6 * UNIT);
        _contribute(pot, BOB, 4 * UNIT);

        vm.prank(ORGANIZER);
        pot.payout();

        _assertTrue(pot.paidOut());
        _assertEq(token.balanceOf(ORGANIZER), 10 * UNIT);
        _assertFalse(pot.isContributionOpen());
    }

    function testFlexiblePotPayoutsAllContributions() public {
        Pot pot = _createPot(false, 0, 0, UNIT);
        _contribute(pot, ALICE, 2 * UNIT);
        _contribute(pot, BOB, 3 * UNIT);

        vm.prank(ORGANIZER);
        pot.payout();

        _assertEq(token.balanceOf(ORGANIZER), 5 * UNIT);
        _assertTrue(pot.paidOut());
    }

    function testPreventsDoublePayout() public {
        Pot pot = _createPot(false, 0, 0, UNIT);
        _contribute(pot, ALICE, UNIT);
        vm.prank(ORGANIZER);
        pot.payout();

        vm.prank(ORGANIZER);
        vm.expectRevert(Pot.PayoutNotEligible.selector);
        pot.payout();
    }

    function testRefundUnavailableBeforeDeadline() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, UNIT);

        vm.prank(ALICE);
        vm.expectRevert(Pot.RefundNotEligible.selector);
        pot.claimRefund();
    }

    function testRefundsContributorsAfterFailedTarget() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, 2 * UNIT);
        _contribute(pot, BOB, 3 * UNIT);
        vm.warp(DEADLINE);

        vm.prank(ALICE);
        pot.claimRefund();
        vm.prank(BOB);
        pot.claimRefund();

        _assertEq(token.balanceOf(ALICE), 100 * UNIT);
        _assertEq(token.balanceOf(BOB), 100 * UNIT);
        _assertEq(pot.totalRefunded(), 5 * UNIT);
        _assertTrue(pot.refundsClaimed(ALICE));
        _assertTrue(pot.refundsClaimed(BOB));
    }

    function testPreventsDoubleRefund() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, 2 * UNIT);
        vm.warp(DEADLINE);
        vm.prank(ALICE);
        pot.claimRefund();

        vm.prank(ALICE);
        vm.expectRevert(Pot.RefundAlreadyClaimed.selector);
        pot.claimRefund();
    }

    function testRefundUnavailableForContributorWithoutContribution() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, UNIT);
        vm.warp(DEADLINE);

        vm.prank(BOB);
        vm.expectRevert(Pot.NoRefundAvailable.selector);
        pot.claimRefund();
    }

    function testTransferFailureRollsBackContributionAccounting() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        token.setTransfersDisabled(true);

        vm.prank(ALICE);
        vm.expectRevert(MockUSDC.TransfersDisabled.selector);
        pot.contribute(UNIT);

        _assertEq(pot.totalContributed(), 0);
        _assertEq(pot.contributions(ALICE), 0);
    }

    function testReentrantTokenCannotReenterContribution() public {
        ReentrantUSDC reentrantToken = new ReentrantUSDC();
        PotFactory reentrantFactory = new PotFactory(IERC20(address(reentrantToken)));
        vm.prank(ORGANIZER);
        Pot pot = Pot(reentrantFactory.createPot("Reentrancy", "", true, 10 * UNIT, DEADLINE, UNIT));
        reentrantToken.mint(ALICE, 2 * UNIT);
        reentrantToken.configureReentry(pot);

        vm.startPrank(ALICE);
        reentrantToken.approve(address(pot), type(uint256).max);
        pot.contribute(UNIT);
        vm.stopPrank();

        _assertTrue(reentrantToken.reentryBlocked());
        _assertEq(pot.totalContributed(), UNIT);
        _assertEq(pot.contributions(ALICE), UNIT);
    }

    function testPayoutTransferFailureRollsBackSettlementState() public {
        Pot pot = _createPot(false, 0, 0, UNIT);
        _contribute(pot, ALICE, UNIT);
        token.setTransfersDisabled(true);

        vm.prank(ORGANIZER);
        vm.expectRevert(MockUSDC.TransfersDisabled.selector);
        pot.payout();

        _assertFalse(pot.paidOut());
        _assertEq(pot.totalContributed(), UNIT);
    }

    function testRefundTransferFailureRollsBackClaimState() public {
        Pot pot = _createPot(true, 10 * UNIT, DEADLINE, UNIT);
        _contribute(pot, ALICE, UNIT);
        vm.warp(DEADLINE);
        token.setTransfersDisabled(true);

        vm.prank(ALICE);
        vm.expectRevert(MockUSDC.TransfersDisabled.selector);
        pot.claimRefund();

        _assertFalse(pot.refundsClaimed(ALICE));
        _assertEq(pot.totalRefunded(), 0);
    }

    function testRejectsFeeOnTransferTokens() public {
        FeeToken feeToken = new FeeToken();
        PotFactory feeFactory = new PotFactory(IERC20(address(feeToken)));
        vm.prank(ORGANIZER);
        Pot feePot = Pot(feeFactory.createPot("Fee token", "", true, 10 * UNIT, DEADLINE, UNIT));
        feeToken.mint(ALICE, 10 * UNIT);

        vm.prank(ALICE);
        feeToken.approve(address(feePot), type(uint256).max);
        vm.prank(ALICE);
        vm.expectRevert(Pot.UnsupportedTransferFee.selector);
        feePot.contribute(UNIT);

        _assertEq(feePot.totalContributed(), 0);
    }

    function testFactoryRejectsNonContractToken() public {
        vm.expectRevert(PotFactory.InvalidToken.selector);
        new PotFactory(IERC20(address(0x1234)));
    }

    function _createPot(
        bool targetBased,
        uint256 targetAmount,
        uint64 deadline,
        uint256 minimumContribution
    ) private returns (Pot) {
        return _create("Test pot", targetBased, targetAmount, deadline, minimumContribution);
    }

    function _create(
        string memory name,
        bool targetBased,
        uint256 targetAmount,
        uint64 deadline,
        uint256 minimumContribution
    ) private returns (Pot) {
        vm.prank(ORGANIZER);
        return Pot(
            factory.createPot(name, "", targetBased, targetAmount, deadline, minimumContribution)
        );
    }

    function _contribute(Pot pot, address contributor, uint256 amount) private {
        vm.startPrank(contributor);
        token.approve(address(pot), type(uint256).max);
        pot.contribute(amount);
        vm.stopPrank();
    }

    function _assertEq(uint256 actual, uint256 expected) private pure {
        require(actual == expected, "assert eq uint failed");
    }

    function _assertEq(address actual, address expected) private pure {
        require(actual == expected, "assert eq address failed");
    }

    function _assertFalse(bool value) private pure {
        require(!value, "assert false failed");
    }

    function _assertTrue(bool value) private pure {
        require(value, "assert true failed");
    }
}

contract FeeToken is MockUSDC {
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        uint256 fee = value / 100;
        bool success = super.transferFrom(from, to, value);
        if (fee > 0) _burn(to, fee);
        return success;
    }
}

contract ReentrantUSDC is MockUSDC {
    Pot private targetPot;
    bool private attackEnabled;
    bool public reentryBlocked;

    function configureReentry(Pot targetPot_) external {
        targetPot = targetPot_;
        attackEnabled = true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (attackEnabled) {
            attackEnabled = false;
            try targetPot.contribute(1) { }
            catch {
                reentryBlocked = true;
            }
        }

        return super.transferFrom(from, to, value);
    }
}
