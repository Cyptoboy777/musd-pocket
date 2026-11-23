// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocketV3} from "../src/MUSDPocketV3.sol";
import {MockMUSDPermit, MockPriceFeed} from "../src/mocks/MezoMocks.sol";
import {
    MockSavingsRate,
    MockBorrowerOpsV3,
    MockTroveManagerV3,
    MockBorrowerOpsSigV3
} from "../src/mocks/MezoMocksV3.sol";

contract MUSDPocketV3Test is Test {
    MUSDPocketV3 pocket;
    MockMUSDPermit musd;
    MockSavingsRate vault;
    MockBorrowerOpsV3 bo;
    MockTroveManagerV3 tm;
    MockBorrowerOpsSigV3 bos;
    MockPriceFeed pf;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address protocol = makeAddr("pcv");

    function setUp() public {
        vm.warp(1_760_000_000);
        musd = new MockMUSDPermit();
        vault = new MockSavingsRate(address(musd));
        bo = new MockBorrowerOpsV3();
        tm = new MockTroveManagerV3();
        bos = new MockBorrowerOpsSigV3(address(musd), address(tm), address(bo));
        pf = new MockPriceFeed();
        pocket = new MUSDPocketV3(_cfg(address(vault)));
        musd.mint(alice, 50_000e18);
        musd.mint(bob, 10_000e18);
        musd.mint(protocol, 1_000_000e18);
        vm.prank(alice);
        musd.approve(address(pocket), type(uint256).max);
        vm.prank(bob);
        musd.approve(address(pocket), type(uint256).max);
        vm.prank(protocol);
        musd.approve(address(vault), type(uint256).max);
    }

    function _cfg(address v) internal view returns (MUSDPocketV3.Config memory) {
        return MUSDPocketV3.Config({
            musd: address(musd),
            borrowerOperations: address(bo),
            borrowerOperationsSignatures: address(bos),
            troveManager: address(tm),
            priceFeed: address(pf),
            savingsVault: v,
            owner: owner
        });
    }

    function _goal(address who, uint256 days_) internal returns (uint256 id) {
        vm.prank(who);
        id = pocket.createGoal("Emergency fund", 5_000e18, uint64(block.timestamp + days_ * 1 days), false);
    }

    function _dep(address who, uint256 id, uint256 amt) internal {
        vm.prank(who);
        pocket.deposit(id, amt);
    }

    function _yield(uint256 amt) internal {
        vm.prank(protocol);
        vault.receiveProtocolYield(amt);
    }

    function _bal(uint256 id) internal view returns (uint256 b) {
        (,,, b,,,) = pocket.getGoal(id);
    }

    /// Owed MUSD is always backed by what the Pocket holds plus its vault position.
    function _assertSolvent() internal view {
        uint256 held = musd.balanceOf(address(pocket));
        assertEq(vault.balanceOf(address(pocket)), pocket.totalInVault(), "vault shares == totalInVault");
        assertGe(held, (pocket.totalLocked() - pocket.totalInVault()) + pocket.feePool() + pocket.yieldPool(), "liquid backed");
    }

    // ------------------------------------------------------------ config

    function test_constructor_rejectsZero() public {
        MUSDPocketV3.Config memory c = _cfg(address(vault));
        c.borrowerOperations = address(0);
        vm.expectRevert(MUSDPocketV3.ZeroAddress.selector);
        new MUSDPocketV3(c);
    }

    function test_constructor_rejectsVaultForOtherToken() public {
        MockMUSDPermit other = new MockMUSDPermit();
        MockSavingsRate wrong = new MockSavingsRate(address(other));
        vm.expectRevert(MUSDPocketV3.VaultMismatch.selector);
        new MUSDPocketV3(_cfg(address(wrong)));
    }

    function test_earnFlagOff_whenNoVault() public {
        MUSDPocketV3 p = new MUSDPocketV3(_cfg(address(0)));
        assertFalse(p.earnAvailable());
        vm.prank(alice);
        uint256 id = p.createGoal("Rent", 100e18, uint64(block.timestamp + 10 days), false);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV3.EarnUnavailable.selector);
        p.setEarn(id, true);
    }

    // ------------------------------------------------------------ earn mode

    function test_earn_movesBalanceIntoVault() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        vm.prank(alice);
        pocket.setEarn(id, true);
        assertEq(vault.balanceOf(address(pocket)), 1_000e18);
        assertEq(musd.balanceOf(address(pocket)), 0);
        (bool on, uint256 inVault,,) = pocket.earnInfo(id);
        assertTrue(on);
        assertEq(inVault, 1_000e18);
        _assertSolvent();
    }

    function test_earn_laterDepositsAutoPark() public {
        uint256 id = _goal(alice, 30);
        vm.prank(alice);
        pocket.setEarn(id, true);
        _dep(alice, id, 400e18);
        assertEq(vault.balanceOf(address(pocket)), 400e18);
        assertEq(_bal(id), 400e18);
        _assertSolvent();
    }

    function test_earn_onlyGoalOwner() public {
        uint256 id = _goal(alice, 30);
        vm.prank(bob);
        vm.expectRevert(MUSDPocketV3.NotGoalOwner.selector);
        pocket.setEarn(id, true);
    }

    function test_earn_withdrawReturnsPrincipalPlusYield() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        vm.prank(alice);
        pocket.setEarn(id, true);
        _yield(50e18); // only depositor is the Pocket, so all 50 is this goal's
        assertEq(pocket.pendingYield(id), 50e18);

        vm.warp(block.timestamp + 31 days);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertEq(musd.balanceOf(alice) - before, 1_050e18);
        assertEq(pocket.goalYieldEarned(id), 50e18);
        assertEq(pocket.totalInVault(), 0);
        _assertSolvent();
    }

    function test_earn_yieldSplitByPrincipalAcrossGoals() public {
        uint256 a = _goal(alice, 30);
        uint256 b = _goal(bob, 30);
        _dep(alice, a, 3_000e18);
        _dep(bob, b, 1_000e18);
        vm.prank(alice);
        pocket.setEarn(a, true);
        vm.prank(bob);
        pocket.setEarn(b, true);
        _yield(40e18);
        assertEq(pocket.pendingYield(a), 30e18);
        assertEq(pocket.pendingYield(b), 10e18);

        // Bob leaves first. The vault pays the Pocket all 40 on Bob's withdraw; Alice's 30 waits in yieldPool.
        vm.warp(block.timestamp + 31 days);
        vm.prank(bob);
        pocket.withdraw(b);
        assertEq(pocket.yieldPool(), 30e18);
        _assertSolvent();

        // Owner cannot sweep Alice's yield as "stray".
        assertEq(pocket.strayBalance(), 0);

        vm.prank(alice);
        pocket.withdraw(a);
        assertEq(pocket.yieldPool(), 0);
        assertEq(musd.balanceOf(alice), 50_000e18 + 30e18);
    }

    function test_earn_lateJoinerDoesNotTakeEarlierYield() public {
        uint256 a = _goal(alice, 30);
        _dep(alice, a, 1_000e18);
        vm.prank(alice);
        pocket.setEarn(a, true);
        _yield(10e18);
        uint256 b = _goal(bob, 30);
        _dep(bob, b, 1_000e18);
        vm.prank(bob);
        pocket.setEarn(b, true);
        assertEq(pocket.pendingYield(b), 0);
        assertEq(pocket.pendingYield(a), 10e18);
    }

    function test_earn_turnOffBringsMoneyBack() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        vm.startPrank(alice);
        pocket.setEarn(id, true);
        vm.stopPrank();
        _yield(20e18);
        vm.prank(alice);
        pocket.setEarn(id, false);
        assertEq(_bal(id), 1_020e18);
        assertEq(musd.balanceOf(address(pocket)), 1_020e18);
        assertEq(pocket.totalInVault(), 0);
        _assertSolvent();
    }

    function test_earn_earlyExitFeeRuleUnchanged() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        vm.prank(alice);
        pocket.setEarn(id, true);
        _yield(100e18);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.earlyWithdraw(id);
        // 2% of the whole balance (1,100), same rule as v2.
        assertEq(musd.balanceOf(alice) - before, 1_078e18);
        assertEq(pocket.feePool(), 22e18);
        _assertSolvent();
    }

    function test_settleYield_anyoneCanCreditGoal() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 500e18);
        vm.prank(alice);
        pocket.setEarn(id, true);
        _yield(5e18);
        vm.prank(bob);
        pocket.settleYield(id);
        assertEq(_bal(id), 505e18);
        assertEq(pocket.pendingYield(id), 0);
        _assertSolvent();
    }

    // ------------------------------------------------------------ recovery mode

    function test_borrowToGoal_blockedInRecoveryMode() public {
        uint256 id = _goal(alice, 30);
        tm.setTrove(alice, 1e18, 3_000e18, 3e18);
        tm.setRecoveryMode(true);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV3.RecoveryModeActive.selector);
        pocket.borrowToGoal(id, 100e18, address(0), address(0), "", block.timestamp + 1 hours);
    }

    function test_borrowToGoal_worksInNormalMode_andAutoParks() public {
        uint256 id = _goal(alice, 30);
        vm.prank(alice);
        pocket.setEarn(id, true);
        tm.setTrove(alice, 1e18, 3_000e18, 2.5e18);
        vm.prank(alice);
        pocket.borrowToGoal(id, 100e18, address(0), address(0), "", block.timestamp + 1 hours);
        assertEq(_bal(id), 100e18);
        assertEq(vault.balanceOf(address(pocket)), 100e18);
        _assertSolvent();
    }

    function test_borrowToGoal_stillRefusesBelow150() public {
        uint256 id = _goal(alice, 30);
        tm.setTrove(alice, 1e18, 3_000e18, 1.4e18);
        vm.prank(alice);
        vm.expectPartialRevert(MUSDPocketV3.LoanTooRisky.selector);
        pocket.borrowToGoal(id, 100e18, address(0), address(0), "", block.timestamp + 1 hours);
    }

    // ------------------------------------------------------------ emergency repay

    function test_repay_atRisk_noFee() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(alice, 1e18, 3_000e18, 1.7e18); // under 200%: at risk
        vm.prank(alice);
        pocket.emergencyRepay(id, 500e18, address(0), address(0), "", block.timestamp + 1 hours);
        assertEq(_bal(id), 500e18);
        assertEq(pocket.feePool(), 0);
        (, uint256 debt,,,,) = tm.getEntireDebtAndColl(alice);
        assertEq(debt, 2_500e18);
        assertEq(pocket.totalRepaidFromGoals(), 500e18);
        _assertSolvent();
    }

    function test_repay_healthyAndLocked_paysEarlyFee() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(alice, 1e18, 3_000e18, 3e18);
        vm.prank(alice);
        pocket.emergencyRepay(id, 500e18, address(0), address(0), "", block.timestamp + 1 hours);
        assertEq(pocket.feePool(), 10e18);
        assertEq(_bal(id), 490e18);
        _assertSolvent();
    }

    function test_repay_afterUnlock_noFee() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(alice, 1e18, 3_000e18, 3e18);
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        pocket.emergencyRepay(id, 500e18, address(0), address(0), "", block.timestamp + 1 hours);
        assertEq(pocket.feePool(), 0);
    }

    function test_repay_inRecoveryMode_noFee() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(alice, 1e18, 3_000e18, 3e18);
        tm.setRecoveryMode(true);
        vm.prank(alice);
        pocket.emergencyRepay(id, 300e18, address(0), address(0), "", block.timestamp + 1 hours);
        assertEq(pocket.feePool(), 0);
    }

    function test_repay_preChecksMinNetDebt() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        // debt 2,500 = 2,300 net + 200 gas comp. Max repay keeping 1,800 net = 500.
        tm.setTrove(alice, 1e18, 2_500e18, 1.7e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MUSDPocketV3.BelowMinNetDebt.selector, 500e18));
        pocket.emergencyRepay(id, 501e18, address(0), address(0), "", block.timestamp + 1 hours);

        vm.prank(alice);
        pocket.emergencyRepay(id, 500e18, address(0), address(0), "", block.timestamp + 1 hours);
        (, uint256 debt,,,,) = tm.getEntireDebtAndColl(alice);
        assertEq(debt, 2_000e18);
    }

    function test_repay_minNetDebtReadLive() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(alice, 1e18, 2_500e18, 1.7e18);
        bo.setMinNetDebt(2_000e18); // governance raised it: max repay is now 300
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MUSDPocketV3.BelowMinNetDebt.selector, 300e18));
        pocket.emergencyRepay(id, 400e18, address(0), address(0), "", block.timestamp + 1 hours);
    }

    function test_repay_pullsFromVaultWhenEarning() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        vm.prank(alice);
        pocket.setEarn(id, true);
        _yield(10e18);
        tm.setTrove(alice, 1e18, 3_000e18, 1.6e18);
        vm.prank(alice);
        pocket.emergencyRepay(id, 600e18, address(0), address(0), "", block.timestamp + 1 hours);
        assertEq(_bal(id), 410e18); // 1,000 + 10 yield - 600
        _assertSolvent();
    }

    function test_repay_noTrove() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 100e18);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV3.NoActiveTrove.selector);
        pocket.emergencyRepay(id, 50e18, address(0), address(0), "", block.timestamp + 1 hours);
    }

    function test_repay_onlyGoalOwner() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(bob, 1e18, 3_000e18, 1.6e18);
        vm.prank(bob);
        vm.expectRevert(MUSDPocketV3.NotGoalOwner.selector);
        pocket.emergencyRepay(id, 100e18, address(0), address(0), "", block.timestamp + 1 hours);
    }

    function test_repay_moreThanGoalHolds() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 100e18);
        tm.setTrove(alice, 1e18, 3_000e18, 1.6e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MUSDPocketV3.InsufficientGoalBalance.selector, 200e18, 100e18));
        pocket.emergencyRepay(id, 200e18, address(0), address(0), "", block.timestamp + 1 hours);
    }

    function test_repay_badSignatureRollsBack() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(alice, 1e18, 3_000e18, 1.6e18);
        bos.setReject(true);
        vm.prank(alice);
        vm.expectRevert(bytes("BorrowerOperationsSignatures: Invalid signature"));
        pocket.emergencyRepay(id, 100e18, address(0), address(0), "", block.timestamp + 1 hours);
        assertEq(_bal(id), 1_000e18);
    }

    // ------------------------------------------------------------ emergency close

    function test_close_fullLoanFromGoal() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 3_000e18);
        tm.setTrove(alice, 1e18, 2_500e18, 1.7e18);
        vm.prank(alice);
        pocket.emergencyClose(id, "", block.timestamp + 1 hours);
        assertEq(_bal(id), 700e18); // 2,300 net debt burned; gas comp is Mezo's
        assertEq(bos.lastCloseRecipient(), alice, "collateral goes to the borrower");
        (, uint256 debt,,,,) = tm.getEntireDebtAndColl(alice);
        assertEq(debt, 0);
        _assertSolvent();
    }

    function test_close_blockedInRecoveryMode() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 3_000e18);
        tm.setTrove(alice, 1e18, 2_500e18, 1.7e18);
        tm.setRecoveryMode(true);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV3.RecoveryModeActive.selector);
        pocket.emergencyClose(id, "", block.timestamp + 1 hours);
    }

    function test_close_needsEnoughInGoal() public {
        uint256 id = _goal(alice, 30);
        _dep(alice, id, 1_000e18);
        tm.setTrove(alice, 1e18, 2_500e18, 1.7e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MUSDPocketV3.InsufficientGoalBalance.selector, 2_300e18, 1_000e18));
        pocket.emergencyClose(id, "", block.timestamp + 1 hours);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_yieldNeverOverpays(uint96 a1, uint96 a2, uint64 y1, uint64 y2) public {
        uint256 d1 = bound(uint256(a1), 1e18, 20_000e18);
        uint256 d2 = bound(uint256(a2), 1e18, 9_000e18);
        uint256 ya = bound(uint256(y1), 0, 5_000e18);
        uint256 yb = bound(uint256(y2), 0, 5_000e18);
        uint256 a = _goal(alice, 30);
        uint256 b = _goal(bob, 30);
        _dep(alice, a, d1);
        vm.prank(alice);
        pocket.setEarn(a, true);
        if (ya > 0) _yield(ya);
        _dep(bob, b, d2);
        vm.prank(bob);
        pocket.setEarn(b, true);
        if (yb > 0) _yield(yb);
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        pocket.withdraw(a);
        _assertSolvent();
        vm.prank(bob);
        pocket.withdraw(b);
        _assertSolvent();
        assertEq(pocket.totalLocked(), 0);
        // Whatever is left is rounding dust kept for goals, never more than 2 wei per settle.
        assertLe(pocket.yieldPool(), 10);
    }
}
