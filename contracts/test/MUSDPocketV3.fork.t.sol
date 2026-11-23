// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocketV3} from "../src/MUSDPocketV3.sol";

interface IBO3 {
    function openTrove(uint256 debt, address upperHint, address lowerHint) external payable;
    function minNetDebt() external view returns (uint256);
}

interface IBOS3 {
    function getNonce(address) external view returns (uint256);
}

interface ITM3 {
    function getEntireDebtAndColl(address)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256);
    function getTroveStatus(address) external view returns (uint256);
}

interface IPF3 {
    function fetchPrice() external view returns (uint256);
}

interface IERC20F {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

interface ISMUSD {
    function receiveProtocolYield(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function yieldIndex() external view returns (uint256);
}

/// @notice v3 against the live MUSD protocol and the live sMUSD vault on a Mezo testnet fork.
///         RUN_FORK=1 forge test --match-contract V3Fork -vv
/// @dev The PriceFeed is pinned with vm.mockCall (Mezo's oracle precompile is not available
///      in a local fork). Everything else is live code: BorrowerOperations,
///      BorrowerOperationsSignatures (real EIP-712 checks), TroveManager, MUSD, MUSDSavingsRate.
contract MUSDPocketV3ForkTest is Test {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BORROWER_OPS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant BOS = 0xD757e3646AF370b15f32EB557F0F8380Df7D639e;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    /// PCV(0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af).feeRecipient() on Mezo testnet
    address constant SMUSD = 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16;

    bytes32 constant REPAY_TYPEHASH = keccak256("RepayMUSD(uint256 amount,address borrower,uint256 nonce,uint256 deadline)");
    bytes32 constant CLOSE_TYPEHASH =
        keccak256("CloseTrove(address borrower,address recipient,uint256 nonce,uint256 deadline)");

    MUSDPocketV3 pocket;
    uint256 alicePk = 0xA11CE;
    address alice;
    bool on;

    function setUp() public {
        on = vm.envOr("RUN_FORK", false);
        if (!on) return;
        vm.createSelectFork(vm.envOr("MEZO_TESTNET_RPC", string("https://rpc.test.mezo.org")));
        vm.mockCall(PRICE_FEED, abi.encodeWithSelector(IPF3.fetchPrice.selector), abi.encode(uint256(80_000e18)));
        alice = vm.addr(alicePk);
        pocket = new MUSDPocketV3(
            MUSDPocketV3.Config({
                musd: MUSD,
                borrowerOperations: BORROWER_OPS,
                borrowerOperationsSignatures: BOS,
                troveManager: TROVE_MANAGER,
                priceFeed: PRICE_FEED,
                savingsVault: SMUSD,
                owner: address(this)
            })
        );
        // Alice: 0.1 BTC collateral, 3,000 MUSD debt.
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        IBO3(BORROWER_OPS).openTrove{value: 0.1 ether}(3_000e18, address(0), address(0));
        vm.prank(alice);
        IERC20F(MUSD).approve(address(pocket), type(uint256).max);
    }

    function _ds() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("BorrowerOperationsSignatures"),
                keccak256("1"),
                block.chainid,
                BOS
            )
        );
    }

    function _signStruct(bytes32 structHash) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePk, keccak256(abi.encodePacked("\x19\x01", _ds(), structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _debt() internal view returns (uint256) {
        (, uint256 p, uint256 i,,,) = ITM3(TROVE_MANAGER).getEntireDebtAndColl(alice);
        return p + i;
    }

    function _goal(uint256 amt) internal returns (uint256 id) {
        vm.startPrank(alice);
        id = pocket.createGoal("School fees", 5_000e18, uint64(block.timestamp + 60 days), false);
        pocket.deposit(id, amt);
        vm.stopPrank();
    }

    function test_fork_earnInRealSavingsVault() public {
        if (!on) return;
        uint256 id = _goal(1_000e18);
        vm.prank(alice);
        pocket.setEarn(id, true);
        assertEq(ISMUSD(SMUSD).balanceOf(address(pocket)), 1_000e18, "Pocket holds real sMUSD");

        // Push protocol yield into the real vault the way PCV does (receiveProtocolYield is open).
        uint256 idx0 = ISMUSD(SMUSD).yieldIndex();
        vm.startPrank(alice);
        IERC20F(MUSD).approve(SMUSD, 500e18);
        ISMUSD(SMUSD).receiveProtocolYield(500e18);
        vm.stopPrank();
        assertGt(ISMUSD(SMUSD).yieldIndex(), idx0);
        uint256 pend = pocket.pendingYield(id);
        assertGt(pend, 0, "goal sees vault yield");
        emit log_named_decimal_uint("goal yield from live vault", pend, 18);

        vm.warp(block.timestamp + 61 days);
        vm.mockCall(PRICE_FEED, abi.encodeWithSelector(IPF3.fetchPrice.selector), abi.encode(uint256(80_000e18)));
        uint256 before = IERC20F(MUSD).balanceOf(alice);
        vm.prank(alice);
        pocket.withdraw(id);
        assertGe(IERC20F(MUSD).balanceOf(alice) - before, 1_000e18 + pend, "principal + yield back");
    }

    function test_fork_emergencyRepayRealTrove() public {
        if (!on) return;
        uint256 id = _goal(1_000e18);
        uint256 debt0 = _debt();
        uint256 amt = 400e18;
        uint256 dl = block.timestamp + 10 minutes;
        bytes memory sig = _signStruct(keccak256(abi.encode(REPAY_TYPEHASH, amt, alice, IBOS3(BOS).getNonce(alice), dl)));
        vm.prank(alice);
        pocket.emergencyRepay(id, amt, address(0), address(0), sig, dl);
        assertApproxEqAbs(_debt(), debt0 - amt, 1e15, "trove debt fell by the repay");
        (,,, uint256 bal,,,) = pocket.getGoal(id);
        assertLe(bal, 600e18);
    }

    function test_fork_repayMinNetDebtPrecheck() public {
        if (!on) return;
        uint256 id = _goal(2_000e18);
        uint256 net = _debt() - 200e18;
        uint256 minNet = IBO3(BORROWER_OPS).minNetDebt();
        uint256 tooMuch = net - minNet + 1e18;
        uint256 dl = block.timestamp + 10 minutes;
        bytes memory sig =
            _signStruct(keccak256(abi.encode(REPAY_TYPEHASH, tooMuch, alice, IBOS3(BOS).getNonce(alice), dl)));
        vm.prank(alice);
        vm.expectPartialRevert(MUSDPocketV3.BelowMinNetDebt.selector);
        pocket.emergencyRepay(id, tooMuch, address(0), address(0), sig, dl);
    }

    function test_fork_emergencyCloseRealTrove() public {
        if (!on) return;
        // Alice needs net debt (~2,800) in the goal; give her the rest from a whale-free source: a second trove.
        address helper = makeAddr("helper");
        vm.deal(helper, 1 ether);
        vm.prank(helper);
        IBO3(BORROWER_OPS).openTrove{value: 0.2 ether}(3_000e18, address(0), address(0));
        vm.prank(helper);
        IERC20F(MUSD).transfer(alice, 2_000e18);

        uint256 id = _goal(IERC20F(MUSD).balanceOf(alice));
        uint256 btcBefore = alice.balance;
        uint256 dl = block.timestamp + 10 minutes;
        bytes memory sig =
            _signStruct(keccak256(abi.encode(CLOSE_TYPEHASH, alice, alice, IBOS3(BOS).getNonce(alice), dl)));
        vm.prank(alice);
        pocket.emergencyClose(id, sig, dl);
        assertEq(ITM3(TROVE_MANAGER).getTroveStatus(alice), 2, "closedByOwner");
        assertGt(alice.balance, btcBefore, "collateral BTC went to the borrower");
    }
}
