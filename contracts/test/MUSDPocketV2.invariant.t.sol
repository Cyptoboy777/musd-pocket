// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";
import {MockMUSDPermit, MockBorrowerOpsSig, MockTroveManager, MockPriceFeed} from "../src/mocks/MezoMocks.sol";

contract PocketHandler is Test {
    MUSDPocketV2 public pocket;
    MockMUSDPermit public musd;
    MockTroveManager public tm;

    address public alice = makeAddr("alice");
    uint256 public goalId;
    uint256 public actions;

    function init(MUSDPocketV2 pocket_, MockMUSDPermit musd_, MockTroveManager tm_, uint256 goalId_) external {
        pocket = pocket_;
        musd = musd_;
        tm = tm_;
        goalId = goalId_;
    }

    function deposit(uint96 raw) external {
        uint256 amount = bound(uint256(raw), 1, 500e18);
        if (musd.balanceOf(alice) < amount) return;
        actions++;
        vm.startPrank(alice);
        musd.approve(address(pocket), amount);
        pocket.deposit(goalId, amount);
        vm.stopPrank();
    }

    function borrow(uint96 raw) external {
        uint256 amount = bound(uint256(raw), 1, 200e18);
        tm.setIcrAfterBorrow(alice, 2e18);
        actions++;
        vm.prank(alice);
        pocket.borrowToGoal(goalId, amount, address(0), address(0), hex"01", block.timestamp + 1 days);
    }

    function earlyExit() external {
        (,,, uint256 bal,,,) = pocket.getGoal(goalId);
        if (bal == 0) return;
        actions++;
        vm.prank(alice);
        pocket.earlyWithdraw(goalId);
        vm.prank(alice);
        goalId = pocket.createGoal("Again", 1e18, uint64(block.timestamp + 10 days), false);
    }
}

/// forge-config: default.invariant.runs = 40
/// forge-config: default.invariant.depth = 20
/// forge-config: default.invariant.fail_on_revert = false
contract MUSDPocketV2InvariantTest is Test {
    MUSDPocketV2 pocket;
    MockMUSDPermit musd;
    PocketHandler handler;

    function setUp() public {
        musd = new MockMUSDPermit();
        MockTroveManager tm = new MockTroveManager();
        MockPriceFeed pf = new MockPriceFeed();
        MockBorrowerOpsSig bos = new MockBorrowerOpsSig(address(musd), address(tm));
        address owner = makeAddr("owner");
        pocket = new MUSDPocketV2(address(musd), address(bos), address(tm), address(pf), owner);
        musd.mint(makeAddr("alice"), 50_000e18);
        vm.warp(1_760_000_000);

        handler = new PocketHandler();
        vm.prank(handler.alice());
        uint256 id = pocket.createGoal("Emergency fund", 1_000e18, uint64(block.timestamp + 40 days), false);
        handler.init(pocket, musd, tm, id);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = PocketHandler.deposit.selector;
        selectors[1] = PocketHandler.borrow.selector;
        selectors[2] = PocketHandler.earlyExit.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_solvent() public view {
        assertGe(musd.balanceOf(address(pocket)), pocket.totalLocked() + pocket.feePool());
        assertEq(pocket.strayBalance(), 0);
    }

    function invariant_openGoalKeepsCreationFee() public view {
        uint256 id = handler.goalId();
        (,,,,, bool active,) = pocket.getGoal(id);
        if (!active) return;
        uint16 snap = pocket.goalEarlyFeeBps(id);
        assertLe(snap, pocket.MAX_EARLY_FEE_BPS());
    }
}
