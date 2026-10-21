// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocket} from "../src/MUSDPocket.sol";
import {MockMUSD} from "../src/mocks/MockMUSD.sol";

/// @notice Security-review tests (docs/SECURITY_REVIEW.md). The contract is unchanged; these
///         tests pin down access control, fee bounds and accounting, and document known behaviour.
contract MUSDPocketSecurityTest is Test {
    MUSDPocket internal pocket;
    MockMUSD internal musd;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");
    address internal admin = makeAddr("admin");
    uint256 internal constant ONE = 1e18;

    function setUp() public {
        musd = new MockMUSD();
        pocket = new MUSDPocket(address(musd), admin);
        musd.mint(alice, 10_000 * ONE);
        musd.mint(bob, 10_000 * ONE);
        vm.prank(alice);
        musd.approve(address(pocket), type(uint256).max);
        vm.prank(bob);
        musd.approve(address(pocket), type(uint256).max);
    }

    function _goal(address who, uint64 lockSecs, bool family) internal returns (uint256 id) {
        vm.prank(who);
        id = pocket.createGoal("Goal", 1000 * ONE, uint64(block.timestamp + lockSecs), family);
    }

    // ---- admin: fee cap and access control -------------------------------------------

    function test_feeCap_enforced() public {
        vm.prank(admin);
        pocket.setEarlyFeeBps(500);
        assertEq(pocket.earlyFeeBps(), 500);
        vm.prank(admin);
        vm.expectRevert(MUSDPocket.FeeTooHigh.selector);
        pocket.setEarlyFeeBps(501);
    }

    function testFuzz_feeCap(uint16 bps) public {
        vm.prank(admin);
        if (bps > 500) vm.expectRevert(MUSDPocket.FeeTooHigh.selector);
        pocket.setEarlyFeeBps(bps);
    }

    function test_onlyOwner_admin() public {
        vm.startPrank(mallory);
        vm.expectRevert(MUSDPocket.NotOwner.selector);
        pocket.setEarlyFeeBps(0);
        vm.expectRevert(MUSDPocket.NotOwner.selector);
        pocket.claimFees(mallory);
        vm.expectRevert(MUSDPocket.NotOwner.selector);
        pocket.transferOwnership(mallory);
        vm.stopPrank();
    }

    /// Owner can only ever take the fee pool, never goal principal.
    function test_claimFees_cannotTouchPrincipal() public {
        uint256 a = _goal(alice, 30 days, false);
        uint256 b = _goal(bob, 30 days, false);
        vm.prank(alice);
        pocket.deposit(a, 500 * ONE);
        vm.prank(bob);
        pocket.deposit(b, 100 * ONE);
        vm.prank(bob);
        pocket.earlyWithdraw(b); // 2 MUSD fee

        vm.prank(admin);
        pocket.claimFees(admin);
        assertEq(musd.balanceOf(admin), 2 * ONE);
        vm.prank(admin);
        vm.expectRevert(MUSDPocket.BadAmount.selector); // pool empty, nothing more to take
        pocket.claimFees(admin);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        pocket.withdraw(a);
        assertEq(musd.balanceOf(alice), 10_000 * ONE); // alice whole
        assertEq(musd.balanceOf(address(pocket)), 0);
    }

    /// Finding M-1: fee changes apply to goals that already exist (bounded by the 5% cap).
    function test_feeChange_appliesRetroactively_boundedByCap() public {
        uint256 id = _goal(alice, 30 days, false);
        vm.prank(alice);
        pocket.deposit(id, 1000 * ONE);
        vm.prank(admin);
        pocket.setEarlyFeeBps(500);
        vm.prank(alice);
        pocket.earlyWithdraw(id);
        assertEq(pocket.feePool(), 50 * ONE); // 5%, not the 2% shown at creation
    }

    // ---- users: access control ---------------------------------------------------------

    function test_onlyGoalOwner_canWithdraw_evenSharedContributor() public {
        uint256 id = _goal(alice, 30 days, true);
        vm.prank(alice);
        pocket.setFamilyMember(id, bob, true);
        vm.prank(bob);
        pocket.deposit(id, 100 * ONE);

        vm.prank(bob);
        vm.expectRevert(MUSDPocket.NotGoalOwner.selector);
        pocket.earlyWithdraw(id);
        vm.warp(block.timestamp + 30 days);
        vm.prank(mallory);
        vm.expectRevert(MUSDPocket.NotGoalOwner.selector);
        pocket.withdraw(id);
    }

    function test_removedContributor_cannotDeposit() public {
        uint256 id = _goal(alice, 30 days, true);
        vm.startPrank(alice);
        pocket.setFamilyMember(id, bob, true);
        pocket.setFamilyMember(id, bob, false);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(MUSDPocket.NotContributor.selector);
        pocket.deposit(id, 1 * ONE);
    }

    function test_personalGoal_othersCannotDeposit() public {
        uint256 id = _goal(alice, 30 days, false);
        vm.prank(bob);
        vm.expectRevert(MUSDPocket.NotGoalOwner.selector);
        pocket.deposit(id, 1 * ONE);
    }

    /// sendRemittance always pulls from msg.sender, so an allowance given to the
    /// Pocket can't be spent by a third party.
    function test_remittance_cannotSpendSomeoneElsesAllowance() public {
        vm.prank(mallory);
        vm.expectRevert();
        pocket.sendRemittance(mallory, 100 * ONE, "steal");
        assertEq(musd.balanceOf(alice), 10_000 * ONE);
    }

    function test_closedGoal_cannotBeReused() public {
        uint256 id = _goal(alice, 30 days, false);
        vm.startPrank(alice);
        pocket.deposit(id, 10 * ONE);
        pocket.earlyWithdraw(id);
        vm.expectRevert(MUSDPocket.GoalInactive.selector);
        pocket.deposit(id, 1 * ONE);
        vm.expectRevert(MUSDPocket.GoalInactive.selector);
        pocket.earlyWithdraw(id);
        vm.stopPrank();
    }

    // ---- input validation (documents L-2: past unlock reverts with a panic, not BadLock) ----

    function test_pastUnlock_reverts() public {
        vm.warp(1_000_000);
        vm.prank(alice);
        vm.expectRevert(); // arithmetic underflow panic (0x11) before the BadLock check
        pocket.createGoal("Past", 1, uint64(block.timestamp - 1), false);
    }

    function test_lockBounds() public {
        vm.startPrank(alice);
        vm.expectRevert(MUSDPocket.BadLock.selector);
        pocket.createGoal("Short", 1, uint64(block.timestamp + 1 days - 1), false);
        vm.expectRevert(MUSDPocket.BadLock.selector);
        pocket.createGoal("Long", 1, uint64(block.timestamp + 730 days + 1), false);
        pocket.createGoal("Min", 1, uint64(block.timestamp + 1 days), false);
        pocket.createGoal("Max", 1, uint64(block.timestamp + 730 days), false);
        vm.stopPrank();
    }

    // ---- accounting invariant ---------------------------------------------------------

    /// Contract MUSD balance always equals sum of open goal balances + fee pool.
    function testFuzz_accounting(uint96 d1, uint96 d2, uint96 d3, uint16 bps, bool exitEarly) public {
        d1 = uint96(bound(d1, 1, 3_000 * ONE));
        d2 = uint96(bound(d2, 1, 3_000 * ONE));
        d3 = uint96(bound(d3, 1, 3_000 * ONE));
        bps = uint16(bound(bps, 0, 500));
        vm.prank(admin);
        pocket.setEarlyFeeBps(bps);

        uint256 a = _goal(alice, 10 days, true);
        uint256 b = _goal(bob, 20 days, false);
        vm.prank(alice);
        pocket.setFamilyMember(a, bob, true);
        vm.prank(alice);
        pocket.deposit(a, d1);
        vm.prank(bob);
        pocket.deposit(a, d2);
        vm.prank(bob);
        pocket.deposit(b, d3);

        if (exitEarly) {
            vm.prank(bob);
            pocket.earlyWithdraw(b);
        } else {
            vm.warp(block.timestamp + 20 days);
            vm.prank(bob);
            pocket.withdraw(b);
        }
        (, , , uint256 balA, , ,) = pocket.getGoal(a);
        (, , , uint256 balB, , ,) = pocket.getGoal(b);
        assertEq(musd.balanceOf(address(pocket)), balA + balB + pocket.feePool());
        assertLe(pocket.feePool(), (uint256(d3) * 500) / 10_000);
    }
}
