// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";
import {MockMUSDPermit, MockBorrowerOpsSig, MockTroveManager, MockPriceFeed} from "../src/mocks/MezoMocks.sol";

contract MUSDPocketV2Test is Test {
    MUSDPocketV2 pocket;
    MockMUSDPermit musd;
    MockBorrowerOpsSig bos;
    MockTroveManager tm;
    MockPriceFeed pf;

    address owner = makeAddr("owner");
    uint256 alicePk = 0xA11CE;
    address alice;
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        alice = vm.addr(alicePk);
        musd = new MockMUSDPermit();
        tm = new MockTroveManager();
        pf = new MockPriceFeed();
        bos = new MockBorrowerOpsSig(address(musd), address(tm));
        pocket = new MUSDPocketV2(address(musd), address(bos), address(tm), address(pf), owner);
        musd.mint(alice, 10_000e18);
        musd.mint(bob, 1_000e18);
        vm.warp(1_760_000_000);
    }

    function _goal(address who, bool fam) internal returns (uint256 id) {
        vm.prank(who);
        id = pocket.createGoal("Emergency fund", 1_000e18, uint64(block.timestamp + 30 days), fam);
    }

    function _permitSig(uint256 pk, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        address o = vm.addr(pk);
        bytes32 structHash =
            keccak256(abi.encode(musd.PERMIT_TYPEHASH(), o, spender, value, musd.nonces(o), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", musd.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    // ---------------------------------------------------------------- constructor

    function test_constructorRejectsZero() public {
        vm.expectRevert(MUSDPocketV2.ZeroAddress.selector);
        new MUSDPocketV2(address(musd), address(0), address(tm), address(pf), owner);
    }

    // ---------------------------------------------------------------- permit deposit

    function test_depositWithPermit_oneTx() public {
        uint256 id = _goal(alice, false);
        uint256 dl = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permitSig(alicePk, address(pocket), 250e18, dl);
        vm.prank(alice);
        pocket.depositWithPermit(id, 250e18, dl, v, r, s);
        (,,, uint256 bal,,,) = pocket.getGoal(id);
        assertEq(bal, 250e18);
        assertEq(pocket.totalLocked(), 250e18);
        assertEq(musd.balanceOf(address(pocket)), 250e18);
    }

    function test_depositWithPermit_frontRunPermitStillWorks() public {
        uint256 id = _goal(alice, false);
        uint256 dl = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permitSig(alicePk, address(pocket), 100e18, dl);
        // someone submits the permit first; allowance is set, so the deposit must still go through
        musd.permit(alice, address(pocket), 100e18, dl, v, r, s);
        vm.prank(alice);
        pocket.depositWithPermit(id, 100e18, dl, v, r, s);
        (,,, uint256 bal,,,) = pocket.getGoal(id);
        assertEq(bal, 100e18);
    }

    function test_depositWithPermit_badSigReverts() public {
        uint256 id = _goal(alice, false);
        uint256 dl = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permitSig(0xBEEF, address(pocket), 100e18, dl);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV2.TransferFailed.selector);
        pocket.depositWithPermit(id, 100e18, dl, v, r, s);
    }

    function test_sendWithPermit_movesFundsAndEmitsMemo() public {
        uint256 dl = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permitSig(alicePk, address(pocket), 40e18, dl);
        vm.expectEmit(true, true, true, true);
        emit MUSDPocketV2.RemittanceSent(alice, carol, 40e18, "Rent Oct", keccak256("Rent Oct"));
        vm.prank(alice);
        pocket.sendWithPermit(carol, 40e18, "Rent Oct", dl, v, r, s);
        assertEq(musd.balanceOf(carol), 40e18);
        assertEq(musd.balanceOf(address(pocket)), 0);
    }

    function test_memoTooLongReverts() public {
        vm.prank(alice);
        musd.approve(address(pocket), 1e18);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV2.MemoTooLong.selector);
        pocket.sendRemittance(carol, 1e18, string(new bytes(97)));
    }

    // ---------------------------------------------------------------- borrow to goal

    function test_borrowToGoal_creditsGoalAndChecksHealth() public {
        uint256 id = _goal(alice, false);
        tm.setIcrAfterBorrow(alice, 2.1e18);
        vm.expectEmit(true, true, false, true);
        emit MUSDPocketV2.BorrowedToGoal(id, alice, 300e18, 2.1e18);
        vm.prank(alice);
        pocket.borrowToGoal(id, 300e18, address(0), address(0), hex"01", block.timestamp + 10 minutes);

        (,,, uint256 bal,,,) = pocket.getGoal(id);
        assertEq(bal, 300e18);
        assertEq(pocket.totalBorrowedToGoals(), 300e18);
        assertEq(pocket.totalLocked(), 300e18);
        assertEq(bos.lastBorrower(), alice, "borrower is always msg.sender");
        assertEq(bos.lastRecipient(), address(pocket), "MUSD lands in the pocket");
    }

    function test_borrowToGoal_refusesRiskyLoan() public {
        uint256 id = _goal(alice, false);
        tm.setIcrAfterBorrow(alice, 1.49e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MUSDPocketV2.LoanTooRisky.selector, 1.49e18));
        pocket.borrowToGoal(id, 300e18, address(0), address(0), hex"01", block.timestamp + 10 minutes);
        assertEq(musd.balanceOf(address(pocket)), 0, "whole borrow rolled back");
    }

    function test_borrowToGoal_exactly150IsAllowed() public {
        uint256 id = _goal(alice, false);
        tm.setIcrAfterBorrow(alice, 1.5e18);
        vm.prank(alice);
        pocket.borrowToGoal(id, 10e18, address(0), address(0), hex"01", block.timestamp + 10 minutes);
        (,,, uint256 bal,,,) = pocket.getGoal(id);
        assertEq(bal, 10e18);
    }

    function test_borrowToGoal_mismatchReverts() public {
        uint256 id = _goal(alice, false);
        tm.setIcrAfterBorrow(alice, 3e18);
        bos.setShortBy(1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MUSDPocketV2.BorrowMismatch.selector, 100e18, 100e18 - 1));
        pocket.borrowToGoal(id, 100e18, address(0), address(0), hex"01", block.timestamp + 10 minutes);
    }

    function test_borrowToGoal_badSignatureBubbles() public {
        uint256 id = _goal(alice, false);
        bos.setReject(true);
        vm.prank(alice);
        vm.expectRevert(bytes("BorrowerOperationsSignatures: Invalid signature"));
        pocket.borrowToGoal(id, 100e18, address(0), address(0), hex"01", block.timestamp + 10 minutes);
    }

    function test_borrowToGoal_strangerCannotFillPrivateGoal() public {
        uint256 id = _goal(alice, false);
        tm.setIcrAfterBorrow(bob, 3e18);
        vm.prank(bob);
        vm.expectRevert(MUSDPocketV2.NotGoalOwner.selector);
        pocket.borrowToGoal(id, 100e18, address(0), address(0), hex"01", block.timestamp + 10 minutes);
    }

    function test_borrowToGoal_familyMemberCanBorrowIntoSharedGoal() public {
        uint256 id = _goal(alice, true);
        vm.prank(alice);
        pocket.setFamilyMember(id, bob, true);
        tm.setIcrAfterBorrow(bob, 2.5e18);
        vm.prank(bob);
        pocket.borrowToGoal(id, 120e18, address(0), address(0), hex"01", block.timestamp + 10 minutes);
        (,,, uint256 bal,,,) = pocket.getGoal(id);
        assertEq(bal, 120e18);
        assertEq(bos.lastBorrower(), bob);
    }

    function test_borrowToGoal_zeroAmountReverts() public {
        uint256 id = _goal(alice, false);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV2.BadAmount.selector);
        pocket.borrowToGoal(id, 0, address(0), address(0), hex"01", block.timestamp + 10 minutes);
    }

    // ---------------------------------------------------------------- accounting / admin

    function test_ownerCannotTouchGoalMoney_onlyStray() public {
        uint256 id = _goal(alice, false);
        vm.prank(alice);
        musd.approve(address(pocket), 500e18);
        vm.prank(alice);
        pocket.deposit(id, 500e18);

        vm.prank(owner);
        vm.expectRevert(MUSDPocketV2.BadAmount.selector);
        pocket.recoverStray(owner);

        // someone sends MUSD straight to the contract by mistake
        vm.prank(bob);
        musd.transfer(address(pocket), 7e18);
        assertEq(pocket.strayBalance(), 7e18);
        vm.prank(owner);
        pocket.recoverStray(bob);
        assertEq(musd.balanceOf(bob), 1_000e18);
        assertEq(musd.balanceOf(address(pocket)), 500e18, "goal money untouched");
    }

    function test_earlyWithdrawFeeAndUnlockedWithdraw() public {
        uint256 id = _goal(alice, false);
        vm.startPrank(alice);
        musd.approve(address(pocket), 1_000e18);
        pocket.deposit(id, 1_000e18);
        pocket.earlyWithdraw(id);
        vm.stopPrank();
        assertEq(pocket.feePool(), 20e18);
        assertEq(pocket.totalLocked(), 0);
        assertEq(musd.balanceOf(alice), 10_000e18 - 20e18);

        uint256 id2 = _goal(alice, false);
        vm.startPrank(alice);
        musd.approve(address(pocket), 100e18);
        pocket.deposit(id2, 100e18);
        vm.expectRevert(MUSDPocketV2.StillLocked.selector);
        pocket.withdraw(id2);
        vm.warp(block.timestamp + 30 days);
        pocket.withdraw(id2);
        vm.stopPrank();
        assertEq(musd.balanceOf(alice), 10_000e18 - 20e18);
    }

    function test_nonOwnerAdminReverts() public {
        vm.startPrank(bob);
        vm.expectRevert(MUSDPocketV2.NotOwner.selector);
        pocket.claimFees(bob);
        vm.expectRevert(MUSDPocketV2.NotOwner.selector);
        pocket.recoverStray(bob);
        vm.expectRevert(MUSDPocketV2.NotOwner.selector);
        pocket.setEarlyFeeBps(100);
        vm.stopPrank();
    }

    function test_rejectsRealBtc() public {
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        (bool ok,) = address(pocket).call{value: 1}("");
        assertFalse(ok, "pocket never holds BTC");
        (bool ok0,) = address(pocket).call{value: 0}("");
        assertTrue(ok0, "value-0 call from Mezo's ActivePool is accepted");
    }

    /// Invariant-style fuzz: whatever mix of deposits and borrows, the contract always holds
    /// at least totalLocked + feePool.
    function testFuzz_solvency(uint96 dep, uint96 borrowAmt, bool early) public {
        uint256 d = bound(uint256(dep), 1, 10_000e18);
        uint256 b = bound(uint256(borrowAmt), 1, 1_000_000e18);
        uint256 id = _goal(alice, false);
        vm.startPrank(alice);
        musd.approve(address(pocket), d);
        pocket.deposit(id, d);
        vm.stopPrank();
        tm.setIcrAfterBorrow(alice, 2e18);
        vm.prank(alice);
        pocket.borrowToGoal(id, b, address(0), address(0), hex"01", block.timestamp + 1);
        if (early) {
            vm.prank(alice);
            pocket.earlyWithdraw(id);
        }
        assertGe(musd.balanceOf(address(pocket)), pocket.totalLocked() + pocket.feePool());
        assertEq(pocket.strayBalance(), 0);
    }
}
