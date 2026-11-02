// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

interface IBorrowerOps {
    function openTrove(uint256 debt, address upperHint, address lowerHint) external payable;
}

interface IBOS {
    function getNonce(address) external view returns (uint256);
}

interface ITM {
    function getCurrentICR(address, uint256) external view returns (uint256);
}

interface IPF {
    function fetchPrice() external view returns (uint256);
}

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
}

/// @notice Runs against the real MUSD protocol on a fork of Mezo testnet.
///         RUN_FORK=1 forge test --match-contract Fork -vv
/// @dev Mezo's oracle is a chain precompile that a local fork can't execute, so the
///      PriceFeed answer is pinned with vm.mockCall. Everything else (BorrowerOperations,
///      BorrowerOperationsSignatures, TroveManager, SortedTroves, MUSD) is the live code.
contract MUSDPocketV2ForkTest is Test {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BORROWER_OPS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant BOS = 0xD757e3646AF370b15f32EB557F0F8380Df7D639e;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;

    bytes32 constant WITHDRAW_MUSD_TYPEHASH =
        keccak256("WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)");

    MUSDPocketV2 pocket;
    uint256 alicePk = 0xA11CE;
    address alice;
    bool on;

    function setUp() public {
        on = vm.envOr("RUN_FORK", false);
        if (!on) return;
        vm.createSelectFork(vm.envOr("MEZO_TESTNET_RPC", string("https://rpc.test.mezo.org")));
        vm.mockCall(PRICE_FEED, abi.encodeWithSelector(IPF.fetchPrice.selector), abi.encode(uint256(80_000e18)));
        alice = vm.addr(alicePk);
        pocket = new MUSDPocketV2(MUSD, BOS, TROVE_MANAGER, PRICE_FEED, address(this));

        // Alice opens a real trove: 0.1 BTC collateral, 2,000 MUSD debt (~380% at $80k).
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        IBorrowerOps(BORROWER_OPS).openTrove{value: 0.1 ether}(2_000e18, address(0), address(0));
    }

    function _domainSeparator() internal view returns (bytes32) {
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

    function _sign(uint256 amount, address recipient, uint256 deadline) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(WITHDRAW_MUSD_TYPEHASH, amount, alice, recipient, IBOS(BOS).getNonce(alice), deadline)
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(alicePk, keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash)));
        return abi.encodePacked(r, s, v);
    }

    function test_fork_borrowStraightIntoGoal() public {
        if (!on) return;
        vm.prank(alice);
        uint256 id = pocket.createGoal("School fees", 500e18, uint64(block.timestamp + 60 days), false);
        uint256 dl = block.timestamp + 10 minutes;
        bytes memory sig = _sign(250e18, address(pocket), dl);
        uint256 walletBefore = IERC20Like(MUSD).balanceOf(alice);

        vm.prank(alice);
        pocket.borrowToGoal(id, 250e18, address(0), address(0), sig, dl);

        (,,, uint256 bal,,,) = pocket.getGoal(id);
        assertEq(bal, 250e18, "goal holds the borrowed MUSD");
        assertEq(IERC20Like(MUSD).balanceOf(address(pocket)), 250e18);
        assertEq(IERC20Like(MUSD).balanceOf(alice), walletBefore, "nothing passed through the wallet");
        uint256 icr = ITM(TROVE_MANAGER).getCurrentICR(alice, 80_000e18);
        assertGt(icr, 1.5e18);
        emit log_named_decimal_uint("trove ratio after borrow", icr, 16);
    }

    function test_fork_tamperedAmountRejectedByMezo() public {
        if (!on) return;
        vm.prank(alice);
        uint256 id = pocket.createGoal("Trip", 500e18, uint64(block.timestamp + 60 days), false);
        uint256 dl = block.timestamp + 10 minutes;
        bytes memory sig = _sign(100e18, address(pocket), dl);
        vm.prank(alice);
        vm.expectRevert(bytes("BorrowerOperationsSignatures: Invalid signature"));
        pocket.borrowToGoal(id, 200e18, address(0), address(0), sig, dl);
    }

    function test_fork_tooRiskyBorrowRolledBack() public {
        if (!on) return;
        vm.prank(alice);
        uint256 id = pocket.createGoal("Car", 9_000e18, uint64(block.timestamp + 60 days), false);
        uint256 dl = block.timestamp + 10 minutes;
        // 0.1 BTC at $80k = $8,000. Borrowing 3,500 more takes debt to ~5,500: about 145%.
        bytes memory sig = _sign(3_500e18, address(pocket), dl);
        vm.prank(alice);
        vm.expectPartialRevert(MUSDPocketV2.LoanTooRisky.selector);
        pocket.borrowToGoal(id, 3_500e18, address(0), address(0), sig, dl);
        assertEq(IERC20Like(MUSD).balanceOf(address(pocket)), 0);
    }

    function test_fork_signatureForAnotherRecipientRejected() public {
        if (!on) return;
        vm.prank(alice);
        uint256 id = pocket.createGoal("Rent", 500e18, uint64(block.timestamp + 60 days), false);
        uint256 dl = block.timestamp + 10 minutes;
        bytes memory sig = _sign(100e18, alice, dl); // signed for the wallet, not the pocket
        vm.prank(alice);
        vm.expectRevert(bytes("BorrowerOperationsSignatures: Invalid signature"));
        pocket.borrowToGoal(id, 100e18, address(0), address(0), sig, dl);
    }
}
