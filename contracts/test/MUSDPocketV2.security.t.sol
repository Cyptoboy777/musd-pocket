// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";
import {MockMUSDPermit, MockBorrowerOpsSig, MockTroveManager, MockPriceFeed} from "../src/mocks/MezoMocks.sol";

/// @notice M-1 fee snapshot, M-2 two-step ownership, and deposit callback safety.
contract MUSDPocketV2SecurityTest is Test {
    MUSDPocketV2 pocket;
    MockMUSDPermit musd;
    MockBorrowerOpsSig bos;
    MockTroveManager tm;
    MockPriceFeed pf;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address safe = makeAddr("safe");

    function setUp() public {
        musd = new MockMUSDPermit();
        tm = new MockTroveManager();
        pf = new MockPriceFeed();
        bos = new MockBorrowerOpsSig(address(musd), address(tm));
        pocket = new MUSDPocketV2(address(musd), address(bos), address(tm), address(pf), owner);
        musd.mint(alice, 10_000e18);
        vm.warp(1_760_000_000);
    }

    function _goal(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = pocket.createGoal("Emergency fund", 1_000e18, uint64(block.timestamp + 30 days), false);
    }

    function test_feeSnapshot_ignoresLaterFeeChange() public {
        uint256 oldId = _goal(alice);
        assertEq(pocket.goalEarlyFeeBps(oldId), 200);

        vm.prank(owner);
        pocket.setEarlyFeeBps(500);
        assertEq(pocket.earlyFeeBps(), 500);
        assertEq(pocket.goalEarlyFeeBps(oldId), 200, "open goal keeps the fee it was created with");

        vm.prank(alice);
        uint256 newId = pocket.createGoal("Travel", 100e18, uint64(block.timestamp + 30 days), false);
        assertEq(pocket.goalEarlyFeeBps(newId), 500);

        vm.startPrank(alice);
        musd.approve(address(pocket), 2_000e18);
        pocket.deposit(oldId, 1_000e18);
        pocket.deposit(newId, 1_000e18);
        pocket.earlyWithdraw(oldId);
        pocket.earlyWithdraw(newId);
        vm.stopPrank();

        assertEq(pocket.feePool(), 20e18 + 50e18);
        assertEq(musd.balanceOf(alice), 10_000e18 - 70e18);
    }

    function testFuzz_feeSnapshot_bounded(uint16 nextFee, uint96 amount) public {
        uint16 fee = uint16(bound(nextFee, 0, 500));
        uint256 amt = bound(uint256(amount), 1, 10_000e18);
        uint256 id = _goal(alice);
        vm.prank(owner);
        pocket.setEarlyFeeBps(fee);

        vm.startPrank(alice);
        musd.approve(address(pocket), amt);
        pocket.deposit(id, amt);
        pocket.earlyWithdraw(id);
        vm.stopPrank();

        assertEq(pocket.feePool(), (amt * 200) / 10_000);
        assertEq(musd.balanceOf(address(pocket)), pocket.feePool());
        assertEq(pocket.totalLocked(), 0);
    }

    function test_feeAboveCapStillReverts() public {
        vm.prank(owner);
        vm.expectRevert(MUSDPocketV2.FeeTooHigh.selector);
        pocket.setEarlyFeeBps(501);
    }

    function test_ownership_twoStep() public {
        assertEq(pocket.owner(), owner);
        assertEq(pocket.pendingOwner(), address(0));

        vm.prank(bob);
        vm.expectRevert(MUSDPocketV2.NotOwner.selector);
        pocket.transferOwnership(safe);

        vm.prank(owner);
        vm.expectRevert(MUSDPocketV2.ZeroAddress.selector);
        pocket.transferOwnership(address(0));

        vm.prank(owner);
        pocket.transferOwnership(safe);
        assertEq(pocket.owner(), owner, "owner unchanged until accept");
        assertEq(pocket.pendingOwner(), safe);

        vm.prank(owner);
        vm.expectRevert(MUSDPocketV2.NotPendingOwner.selector);
        pocket.acceptOwnership();

        vm.prank(bob);
        vm.expectRevert(MUSDPocketV2.NotPendingOwner.selector);
        pocket.acceptOwnership();

        vm.prank(bob);
        vm.expectRevert(MUSDPocketV2.NotOwner.selector);
        pocket.setEarlyFeeBps(100);

        vm.prank(safe);
        pocket.acceptOwnership();
        assertEq(pocket.owner(), safe);
        assertEq(pocket.pendingOwner(), address(0));

        vm.prank(owner);
        vm.expectRevert(MUSDPocketV2.NotOwner.selector);
        pocket.setEarlyFeeBps(100);

        vm.prank(safe);
        pocket.setEarlyFeeBps(100);
        assertEq(pocket.earlyFeeBps(), 100);
    }

    function test_ownership_pendingCanBeReplaced() public {
        vm.startPrank(owner);
        pocket.transferOwnership(bob);
        pocket.transferOwnership(safe);
        vm.stopPrank();
        assertEq(pocket.pendingOwner(), safe);

        vm.prank(bob);
        vm.expectRevert(MUSDPocketV2.NotPendingOwner.selector);
        pocket.acceptOwnership();

        vm.prank(safe);
        pocket.acceptOwnership();
        assertEq(pocket.owner(), safe);
    }

    function test_deposit_callbackCannotReenter() public {
        ReenterToken evil = new ReenterToken();
        MUSDPocketV2 evilPocket = new MUSDPocketV2(address(evil), address(bos), address(tm), address(pf), owner);
        evil.setPocket(evilPocket);
        evil.mint(alice, 100e18);

        vm.prank(alice);
        uint256 id = evilPocket.createGoal("Fees", 10e18, uint64(block.timestamp + 2 days), false);
        evil.arm(id, ReenterToken.Attack.Deposit);

        vm.prank(alice);
        // transferFrom reverts with Reentrant. _pullFrom reports that as TransferFailed.
        // The deposit still reverts, so the early credit is rolled back.
        vm.expectRevert(MUSDPocketV2.TransferFailed.selector);
        evilPocket.deposit(id, 10e18);

        (,,, uint256 bal,,,) = evilPocket.getGoal(id);
        assertEq(bal, 0);
        assertEq(evil.balanceOf(address(evilPocket)), 0);
        assertEq(evil.balanceOf(alice), 100e18);
    }

    function test_deposit_callbackCannotWithdrawEarlyCredit() public {
        ReenterToken evil = new ReenterToken();
        MUSDPocketV2 evilPocket = new MUSDPocketV2(address(evil), address(bos), address(tm), address(pf), owner);
        evil.setPocket(evilPocket);
        evil.mint(alice, 100e18);

        vm.prank(alice);
        uint256 id = evilPocket.createGoal("Fees", 10e18, uint64(block.timestamp + 2 days), false);
        vm.warp(block.timestamp + 2 days);
        evil.arm(id, ReenterToken.Attack.Withdraw);

        vm.prank(alice);
        vm.expectRevert(MUSDPocketV2.TransferFailed.selector);
        evilPocket.deposit(id, 40e18);

        assertEq(evil.balanceOf(alice), 100e18);
        assertEq(evilPocket.totalLocked(), 0);
    }
}

/// @dev Token that calls back into the pocket during transferFrom.
contract ReenterToken {
    enum Attack { None, Deposit, Withdraw }

    mapping(address => uint256) public balanceOf;
    MUSDPocketV2 public pocket;
    uint256 public goalId;
    Attack public attack;

    function setPocket(MUSDPocketV2 pocket_) external {
        pocket = pocket_;
    }

    function arm(uint256 id, Attack kind) external {
        goalId = id;
        attack = kind;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        Attack kind = attack;
        attack = Attack.None;
        if (kind == Attack.Deposit) pocket.deposit(goalId, amount);
        if (kind == Attack.Withdraw) pocket.withdraw(goalId);
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
