// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PocketTimelock} from "../src/PocketTimelock.sol";
import {MUSDPocketV3} from "../src/MUSDPocketV3.sol";
import {MockMUSDPermit, MockPriceFeed} from "../src/mocks/MezoMocks.sol";
import {MockSavingsRate, MockBorrowerOpsV3, MockTroveManagerV3, MockBorrowerOpsSigV3} from "../src/mocks/MezoMocksV3.sol";

contract PocketTimelockTest is Test {
    PocketTimelock tl;
    MUSDPocketV3 pocket;
    address admin = makeAddr("admin");
    address eve = makeAddr("eve");

    function setUp() public {
        vm.warp(1_760_000_000);
        tl = new PocketTimelock(admin, 2 days);
        MockMUSDPermit musd = new MockMUSDPermit();
        MockTroveManagerV3 tm = new MockTroveManagerV3();
        MockBorrowerOpsV3 bo = new MockBorrowerOpsV3();
        pocket = new MUSDPocketV3(
            MUSDPocketV3.Config({
                musd: address(musd),
                borrowerOperations: address(bo),
                borrowerOperationsSignatures: address(new MockBorrowerOpsSigV3(address(musd), address(tm), address(bo))),
                troveManager: address(tm),
                priceFeed: address(new MockPriceFeed()),
                savingsVault: address(new MockSavingsRate(address(musd))),
                owner: address(tl)
            })
        );
    }

    function _feeCall() internal pure returns (bytes memory) {
        return abi.encodeWithSelector(MUSDPocketV3.setEarlyFeeBps.selector, uint16(100));
    }

    function test_ownerIsTimelock_directCallsFail() public {
        assertEq(pocket.owner(), address(tl));
        vm.prank(admin);
        vm.expectRevert(MUSDPocketV3.NotOwner.selector);
        pocket.setEarlyFeeBps(100);
    }

    function test_feeChangeWaitsOutDelay() public {
        uint256 eta = block.timestamp + 2 days;
        vm.prank(admin);
        tl.queue(address(pocket), 0, _feeCall(), eta);
        vm.prank(admin);
        vm.expectRevert(PocketTimelock.TooEarly.selector);
        tl.execute(address(pocket), 0, _feeCall(), eta);
        vm.warp(eta);
        vm.prank(admin);
        tl.execute(address(pocket), 0, _feeCall(), eta);
        assertEq(pocket.earlyFeeBps(), 100);
    }

    function test_queueTooSoonRejected() public {
        vm.prank(admin);
        vm.expectRevert(PocketTimelock.EtaTooSoon.selector);
        tl.queue(address(pocket), 0, _feeCall(), block.timestamp + 1 days);
    }

    function test_onlyAdmin() public {
        vm.prank(eve);
        vm.expectRevert(PocketTimelock.NotAdmin.selector);
        tl.queue(address(pocket), 0, _feeCall(), block.timestamp + 3 days);
    }

    function test_cancelAndStale() public {
        uint256 eta = block.timestamp + 2 days;
        vm.startPrank(admin);
        tl.queue(address(pocket), 0, _feeCall(), eta);
        tl.cancel(address(pocket), 0, _feeCall(), eta);
        vm.warp(eta);
        vm.expectRevert(PocketTimelock.NotQueued.selector);
        tl.execute(address(pocket), 0, _feeCall(), eta);
        tl.queue(address(pocket), 0, _feeCall(), block.timestamp + 2 days);
        vm.warp(block.timestamp + 2 days + 15 days);
        vm.expectRevert(PocketTimelock.Stale.selector);
        tl.execute(address(pocket), 0, _feeCall(), eta + 2 days);
        vm.stopPrank();
    }

    function test_adminAndDelayOnlyViaTimelock() public {
        vm.prank(admin);
        vm.expectRevert(PocketTimelock.NotSelf.selector);
        tl.setAdmin(eve);
        bytes memory d = abi.encodeWithSelector(PocketTimelock.setDelay.selector, 3 days);
        uint256 eta = block.timestamp + 2 days;
        vm.prank(admin);
        tl.queue(address(tl), 0, d, eta);
        vm.warp(eta);
        vm.prank(admin);
        tl.execute(address(tl), 0, d, eta);
        assertEq(tl.delay(), 3 days);
    }

    function test_constructorBounds() public {
        vm.expectRevert(PocketTimelock.BadDelay.selector);
        new PocketTimelock(admin, 1 hours);
        vm.expectRevert(PocketTimelock.ZeroAddress.selector);
        new PocketTimelock(address(0), 2 days);
    }
}
