// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {MUSDPocket} from "../src/MUSDPocket.sol";
import {MockMUSD} from "../src/mocks/MockMUSD.sol";

contract MUSDPocketTest is Test {
    MUSDPocket internal pocket;
    MockMUSD internal musd;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal friend = makeAddr("friend");
    address internal admin = makeAddr("admin");

    uint256 internal constant ONE = 1e18;

    function setUp() public {
        musd = new MockMUSD();
        pocket = new MUSDPocket(address(musd), admin);

        musd.mint(alice, 10_000 * ONE);
        musd.mint(bob, 5_000 * ONE);
        musd.mint(friend, 100 * ONE);

        vm.prank(alice);
        musd.approve(address(pocket), type(uint256).max);
        vm.prank(bob);
        musd.approve(address(pocket), type(uint256).max);
    }

    function _createPersonal(address who, string memory name, uint256 target, uint64 lockSecs)
        internal
        returns (uint256 id)
    {
        vm.prank(who);
        id = pocket.createGoal(name, target, uint64(block.timestamp + lockSecs), false);
    }

    function test_createGoal_andDeposit() public {
        uint256 id = _createPersonal(alice, "Emergency fund", 1000 * ONE, 30 days);
        vm.prank(alice);
        pocket.deposit(id, 250 * ONE);

        (
            address o,
            string memory name,
            uint256 target,
            uint256 bal,
            uint64 unlock,
            bool active,
            bool isFamily
        ) = pocket.getGoal(id);

        assertEq(o, alice);
        assertEq(name, "Emergency fund");
        assertEq(target, 1000 * ONE);
        assertEq(bal, 250 * ONE);
        assertTrue(active);
        assertFalse(isFamily);
        assertGt(unlock, block.timestamp);
        assertEq(pocket.progressBps(id), 2500); // 25%
        assertEq(musd.balanceOf(address(pocket)), 250 * ONE);
    }

    function test_withdraw_afterUnlock() public {
        uint256 id = _createPersonal(alice, "Laptop", 500 * ONE, 7 days);
        vm.prank(alice);
        pocket.deposit(id, 500 * ONE);

        vm.warp(block.timestamp + 7 days + 1);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertEq(musd.balanceOf(alice), before + 500 * ONE);

        (, , , uint256 bal, , bool active,) = pocket.getGoal(id);
        assertEq(bal, 0);
        assertFalse(active);
    }

    function test_earlyWithdraw_takesFee() public {
        uint256 id = _createPersonal(alice, "Trip", 200 * ONE, 90 days);
        vm.prank(alice);
        pocket.deposit(id, 200 * ONE);

        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.earlyWithdraw(id);

        // 2% fee default
        uint256 fee = (200 * ONE * 200) / 10_000;
        uint256 net = 200 * ONE - fee;
        assertEq(musd.balanceOf(alice), before + net);
        assertEq(pocket.feePool(), fee);
    }

    function test_revert_withdrawWhileLocked() public {
        uint256 id = _createPersonal(alice, "Locked", 100 * ONE, 30 days);
        vm.prank(alice);
        pocket.deposit(id, 100 * ONE);
        vm.prank(alice);
        vm.expectRevert(MUSDPocket.StillLocked.selector);
        pocket.withdraw(id);
    }

    function test_familyGoal_contributorCanDeposit() public {
        vm.prank(alice);
        uint256 id = pocket.createGoal("Home deposit", 2000 * ONE, uint64(block.timestamp + 180 days), true);

        vm.prank(alice);
        pocket.setFamilyMember(id, bob, true);

        vm.prank(bob);
        pocket.deposit(id, 300 * ONE);

        (, , , uint256 bal, , , bool isFamily) = pocket.getGoal(id);
        assertEq(bal, 300 * ONE);
        assertTrue(isFamily);
        assertTrue(pocket.familyMember(id, bob));
    }

    function test_familyGoal_strangerCannotDeposit() public {
        vm.prank(alice);
        uint256 id = pocket.createGoal("Family trip", 1000 * ONE, uint64(block.timestamp + 60 days), true);

        vm.prank(bob);
        vm.expectRevert(MUSDPocket.NotContributor.selector);
        pocket.deposit(id, 10 * ONE);
    }

    function test_sendRemittance() public {
        vm.prank(alice);
        pocket.sendRemittance(friend, 50 * ONE, "Rent buffer Oct");
        assertEq(musd.balanceOf(friend), 150 * ONE);
    }

    function test_claimFees() public {
        uint256 id = _createPersonal(alice, "Fee", 100 * ONE, 30 days);
        vm.prank(alice);
        pocket.deposit(id, 100 * ONE);
        vm.prank(alice);
        pocket.earlyWithdraw(id);

        uint256 fee = pocket.feePool();
        vm.prank(admin);
        pocket.claimFees(admin);
        assertEq(musd.balanceOf(admin), fee);
        assertEq(pocket.feePool(), 0);
    }

    function test_revert_badLockTooShort() public {
        vm.prank(alice);
        vm.expectRevert(MUSDPocket.BadLock.selector);
        pocket.createGoal("Short", 1, uint64(block.timestamp + 1 hours), false);
    }

    function test_goalsOf() public {
        _createPersonal(alice, "A", 1, 30 days);
        _createPersonal(alice, "B", 1, 60 days);
        uint256[] memory ids = pocket.goalsOf(alice);
        assertEq(ids.length, 2);
    }

    function testFuzz_depositWithdraw(uint128 amount) public {
        vm.assume(amount > 0 && amount < 10_000 * ONE);
        musd.mint(alice, amount);
        uint256 id = _createPersonal(alice, "Fuzz", amount, 14 days);
        vm.prank(alice);
        pocket.deposit(id, amount);
        vm.warp(block.timestamp + 14 days + 1);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertEq(musd.balanceOf(alice), before + amount);
    }
}
