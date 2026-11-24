// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocketV3} from "../src/MUSDPocketV3.sol";
import {PocketTimelock} from "../src/PocketTimelock.sol";
import {MockMUSDPermit, MockPriceFeed} from "../src/mocks/MezoMocks.sol";
import {
    MockSavingsRate,
    MockBorrowerOpsV3,
    MockTroveManagerV3,
    MockBorrowerOpsSigV3
} from "../src/mocks/MezoMocksV3.sol";

/// @notice Performance fee on yield: fee math, the 10% cap, who can change it, the zero default,
///         and proof that principal never pays a fee.
contract MUSDPocketV3YieldFeeTest is Test {
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
    address treasury = makeAddr("treasury");

    function setUp() public {
        vm.warp(1_760_000_000);
        musd = new MockMUSDPermit();
        vault = new MockSavingsRate(address(musd));
        bo = new MockBorrowerOpsV3();
        tm = new MockTroveManagerV3();
        bos = new MockBorrowerOpsSigV3(address(musd), address(tm), address(bo));
        pf = new MockPriceFeed();
        pocket = new MUSDPocketV3(
            MUSDPocketV3.Config({
                musd: address(musd),
                borrowerOperations: address(bo),
                borrowerOperationsSignatures: address(bos),
                troveManager: address(tm),
                priceFeed: address(pf),
                savingsVault: address(vault),
                owner: owner
            })
        );
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

    // ------------------------------------------------------------ helpers

    function _earningGoal(address who, uint256 amount) internal returns (uint256 id) {
        vm.prank(who);
        id = pocket.createGoal("Savings", 5_000e18, uint64(block.timestamp + 30 days), false);
        vm.prank(who);
        pocket.deposit(id, amount);
        vm.prank(who);
        pocket.setEarn(id, true);
    }

    function _yield(uint256 amt) internal {
        vm.prank(protocol);
        vault.receiveProtocolYield(amt);
    }

    function _setFee(uint16 bps) internal {
        vm.prank(owner);
        pocket.setYieldFeeBps(bps);
    }

    function _bal(uint256 id) internal view returns (uint256 b) {
        (,,, b,,,) = pocket.getGoal(id);
    }

    function _assertSolvent() internal view {
        uint256 held = musd.balanceOf(address(pocket));
        assertEq(vault.balanceOf(address(pocket)), pocket.totalInVault(), "vault shares == totalInVault");
        assertGe(held, (pocket.totalLocked() - pocket.totalInVault()) + pocket.feePool() + pocket.yieldPool(), "liquid backed");
    }

    // ------------------------------------------------------------ default is zero

    function test_default_isZero_andSaverKeepsAllYield() public {
        assertEq(pocket.yieldFeeBps(), 0);
        assertEq(pocket.MAX_YIELD_FEE_BPS(), 1000);
        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(50e18);
        vm.warp(block.timestamp + 31 days);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertEq(musd.balanceOf(alice) - before, 1_050e18);
        assertEq(pocket.feePool(), 0);
        _assertSolvent();
    }

    // ------------------------------------------------------------ fee math

    function test_fee_isShareOfYieldOnly() public {
        _setFee(1000); // 10%
        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(50e18);
        assertEq(pocket.pendingYield(id), 50e18, "gross");
        assertEq(pocket.pendingYieldAfterFee(id), 45e18, "net");

        pocket.settleYield(id);
        assertEq(_bal(id), 1_045e18, "goal got principal + 90% of yield");
        assertEq(pocket.feePool(), 5e18, "10% of yield");
        assertEq(pocket.goalYieldEarned(id), 45e18);
        _assertSolvent();

        vm.warp(block.timestamp + 31 days);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertEq(musd.balanceOf(alice) - before, 1_045e18);
        _assertSolvent();
    }

    function test_fee_exactMath_oddAmount() public {
        _setFee(750); // 7.5%
        uint256 id = _earningGoal(alice, 1_000e18);
        uint256 y = 12_345_678e12; // 12.345678 MUSD
        _yield(y);
        pocket.settleYield(id);
        uint256 fee = (y * 750) / 10_000;
        assertEq(pocket.feePool(), fee);
        assertEq(_bal(id), 1_000e18 + y - fee);
        assertEq(pocket.goalYieldEarned(id), y - fee);
        _assertSolvent();
    }

    function test_fee_roundsDown_favouringSaver() public {
        _setFee(1); // 0.01%
        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(9_999e9); // 0.01% of 9,999e9 rounds down to 0 fee... (9,999e9 * 1) / 10,000 = 999,900,000
        pocket.settleYield(id);
        assertEq(pocket.feePool(), (9_999e9 * 1) / 10_000);
        assertEq(_bal(id) + pocket.feePool(), 1_000e18 + 9_999e9, "nothing lost or minted");
        _assertSolvent();
    }

    function test_fee_splitAcrossGoalsByYield() public {
        _setFee(1000);
        uint256 a = _earningGoal(alice, 3_000e18);
        uint256 b = _earningGoal(bob, 1_000e18);
        _yield(40e18);
        pocket.settleYield(a);
        pocket.settleYield(b);
        assertEq(pocket.feePool(), 4e18, "10% of 40");
        assertEq(_bal(a), 3_000e18 + 27e18);
        assertEq(_bal(b), 1_000e18 + 9e18);
        _assertSolvent();
    }

    function test_fee_emitsEvent() public {
        _setFee(1000);
        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(50e18);
        vm.expectEmit(true, false, false, true, address(pocket));
        emit MUSDPocketV3.YieldFeeTaken(id, 5e18);
        pocket.settleYield(id);
    }

    // ------------------------------------------------------------ never on principal

    function test_noFeeOnPrincipal_whenThereIsNoYield() public {
        _setFee(1000);
        uint256 id = _earningGoal(alice, 1_000e18);
        vm.warp(block.timestamp + 31 days);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertEq(musd.balanceOf(alice) - before, 1_000e18, "principal comes back in full");
        assertEq(pocket.feePool(), 0);
        _assertSolvent();
    }

    function test_noFeeOnPrincipal_forGoalsNotEarning() public {
        _setFee(1000);
        vm.prank(alice);
        uint256 id = pocket.createGoal("Plain", 1_000e18, uint64(block.timestamp + 30 days), false);
        vm.prank(alice);
        pocket.deposit(id, 1_000e18);
        _yield(100e18); // vault yield exists, but this goal is not in the vault
        vm.warp(block.timestamp + 31 days);
        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertEq(musd.balanceOf(alice) - before, 1_000e18);
        assertEq(pocket.feePool(), 0);
    }

    function test_depositsAndChipInsNeverPayYieldFee() public {
        _setFee(1000);
        uint256 id = _earningGoal(alice, 1_000e18);
        vm.prank(alice);
        pocket.deposit(id, 500e18);
        assertEq(_bal(id), 1_500e18);
        assertEq(pocket.feePool(), 0);
    }

    // ------------------------------------------------------------ cap and access

    function test_cap_allowsTenPercent_rejectsMore() public {
        _setFee(1000);
        assertEq(pocket.yieldFeeBps(), 1000);
        vm.prank(owner);
        vm.expectRevert(MUSDPocketV3.FeeTooHigh.selector);
        pocket.setYieldFeeBps(1001);
        vm.prank(owner);
        vm.expectRevert(MUSDPocketV3.FeeTooHigh.selector);
        pocket.setYieldFeeBps(type(uint16).max);
        assertEq(pocket.yieldFeeBps(), 1000);
    }

    function test_canBeTurnedBackOff() public {
        _setFee(500);
        _setFee(0);
        assertEq(pocket.yieldFeeBps(), 0);
    }

    function test_onlyOwner_canSetFeeAndRecipient() public {
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV3.NotOwner.selector);
        pocket.setYieldFeeBps(100);
        vm.prank(alice);
        vm.expectRevert(MUSDPocketV3.NotOwner.selector);
        pocket.setFeeRecipient(alice);
        vm.prank(owner);
        vm.expectRevert(MUSDPocketV3.ZeroAddress.selector);
        pocket.setFeeRecipient(address(0));
    }

    function test_changeAppliesToLaterYieldOnly() public {
        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(10e18);
        pocket.settleYield(id); // credited at 0%
        assertEq(pocket.feePool(), 0);
        _setFee(1000);
        _yield(10e18);
        pocket.settleYield(id); // credited at 10%
        assertEq(pocket.feePool(), 1e18);
        assertEq(_bal(id), 1_000e18 + 10e18 + 9e18);
        _assertSolvent();
    }

    // ------------------------------------------------------------ recipient

    function test_recipient_receivesFees_anyoneCanTrigger() public {
        _setFee(1000);
        vm.prank(owner);
        pocket.setFeeRecipient(treasury);
        assertEq(pocket.feeRecipient(), treasury);

        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(50e18);
        pocket.settleYield(id);

        vm.prank(bob); // not the owner
        pocket.claimFeesToRecipient();
        assertEq(musd.balanceOf(treasury), 5e18);
        assertEq(pocket.feePool(), 0);
        _assertSolvent();
    }

    function test_recipient_unsetOrEmptyPoolReverts() public {
        vm.expectRevert(MUSDPocketV3.ZeroAddress.selector);
        pocket.claimFeesToRecipient();
        vm.prank(owner);
        pocket.setFeeRecipient(treasury);
        vm.expectRevert(MUSDPocketV3.BadAmount.selector);
        pocket.claimFeesToRecipient();
    }

    function test_ownerCannotTouchGoalMoney_throughFeePath() public {
        _setFee(1000);
        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(50e18);
        pocket.settleYield(id);
        vm.startPrank(owner);
        pocket.claimFees(owner); // can take only the fee pool
        vm.expectRevert(MUSDPocketV3.BadAmount.selector);
        pocket.claimFees(owner);
        vm.stopPrank();
        assertEq(musd.balanceOf(owner), 5e18);
        assertEq(_bal(id), 1_045e18, "goal untouched");
        _assertSolvent();
    }

    // ------------------------------------------------------------ through the real 2-day timelock

    function test_feeChangeGoesThroughTimelock() public {
        address admin = makeAddr("admin");
        PocketTimelock tl = new PocketTimelock(admin, 2 days);
        vm.prank(owner);
        pocket.transferOwnership(address(tl));
        bytes memory accept = abi.encodeWithSignature("acceptOwnership()");
        uint256 eta = block.timestamp + 2 days;
        vm.prank(admin);
        tl.queue(address(pocket), 0, accept, eta);
        vm.warp(eta);
        vm.prank(admin);
        tl.execute(address(pocket), 0, accept, eta);
        assertEq(pocket.owner(), address(tl));

        // Direct calls fail, even for the timelock admin.
        vm.prank(admin);
        vm.expectRevert(MUSDPocketV3.NotOwner.selector);
        pocket.setYieldFeeBps(500);

        bytes memory call_ = abi.encodeWithSelector(MUSDPocketV3.setYieldFeeBps.selector, uint16(500));
        eta = block.timestamp + 2 days;
        vm.prank(admin);
        tl.queue(address(pocket), 0, call_, eta);
        vm.prank(admin);
        vm.expectRevert(PocketTimelock.TooEarly.selector);
        tl.execute(address(pocket), 0, call_, eta);
        assertEq(pocket.yieldFeeBps(), 0, "still zero while waiting");
        vm.warp(eta);
        vm.prank(admin);
        tl.execute(address(pocket), 0, call_, eta);
        assertEq(pocket.yieldFeeBps(), 500);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_feeNeverExceedsCap_andNothingIsLost(uint16 bps, uint96 rawYield) public {
        bps = uint16(bound(bps, 0, 1000));
        uint256 y = bound(rawYield, 1e12, 100_000e18);
        _setFee(bps);
        uint256 id = _earningGoal(alice, 1_000e18);
        _yield(y);
        uint256 gross = pocket.pendingYield(id);
        pocket.settleYield(id);
        uint256 fee = pocket.feePool();
        assertLe(fee, (gross * 1000) / 10_000, "never above the 10% cap");
        assertEq(fee, (gross * bps) / 10_000);
        assertEq(_bal(id) + fee, 1_000e18 + gross, "saver + fee == principal + gross yield");
        _assertSolvent();
    }
}
