// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

/// @notice Mezo mainnet deploy and preflight for MUSD Pocket.
/// @dev Dry-run this with `forge script` and no `--broadcast`. The shell wrapper
///      `script/deploy-mainnet.sh` refuses to broadcast. A later sponsored deploy
///      passes the multisig as POCKET_OWNER. This file has no private key and no
///      hardcoded owner.
///
///      Chain 31612, BTC gas, and the public RPCs:
///      https://mezo.org/docs/developers/getting-started/
///      Mainnet MUSD:
///      https://mezo.org/docs/users/resources/contracts-reference/
///      BorrowerOperations, BorrowerOperationsSignatures, TroveManager, PriceFeed
///      proxies, published by mezo-org (the repo linked from that getting-started page):
///      https://github.com/mezo-org/musd/releases/tag/v1.1.0
contract DeployV2Mainnet is Script {
    uint256 constant MEZO_MAINNET = 31612;

    // https://mezo.org/docs/users/resources/contracts-reference/
    address constant MUSD = 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186;
    // https://github.com/mezo-org/musd/releases/tag/v1.1.0 (proxy addresses)
    address constant BORROWER_OPERATIONS = 0x44b1bac67dDA612a41a58AAf779143B181dEe031;
    address constant BORROWER_OPS_SIGNATURES = 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a;
    address constant TROVE_MANAGER = 0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193;
    address constant PRICE_FEED = 0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88;

    error WrongChain(uint256 actual, uint256 expected);
    error MissingCode(address target);
    error UnexpectedDependency(string what);
    error OwnerRequired();

    /// @notice Read-only check. Does not deploy.
    function preflight() external view {
        if (block.chainid != MEZO_MAINNET) revert WrongChain(block.chainid, MEZO_MAINNET);
        _assertDependencies();
        console2.log("Preflight only. No transaction.");
        console2.log("chainId", block.chainid);
        console2.log("MUSD", MUSD);
        console2.log("BorrowerOperations", BORROWER_OPERATIONS);
        console2.log("BorrowerOperationsSignatures", BORROWER_OPS_SIGNATURES);
        console2.log("TroveManager", TROVE_MANAGER);
        console2.log("PriceFeed", PRICE_FEED);
    }

    /// @notice Deploy. Forge simulates this unless the caller passes --broadcast.
    ///         POCKET_OWNER must be set in the environment. It is the multisig that
    ///         should own the contract from the first block. It is not defaulted to
    ///         the deployer.
    function run() external {
        address pocketOwner = vm.envAddress("POCKET_OWNER");
        if (pocketOwner == address(0)) revert OwnerRequired();
        if (block.chainid != MEZO_MAINNET) revert WrongChain(block.chainid, MEZO_MAINNET);
        _assertDependencies();

        vm.startBroadcast();
        MUSDPocketV2 pocket =
            new MUSDPocketV2(MUSD, BORROWER_OPS_SIGNATURES, TROVE_MANAGER, PRICE_FEED, pocketOwner);
        vm.stopBroadcast();

        console2.log("MUSDPocketV2", address(pocket));
        console2.log("owner", pocketOwner);
        console2.log("earlyFeeBps", uint256(pocket.earlyFeeBps()));
    }

    function _assertDependencies() internal view {
        _assertCode(MUSD);
        _assertCode(BORROWER_OPERATIONS);
        _assertCode(BORROWER_OPS_SIGNATURES);
        _assertCode(TROVE_MANAGER);
        _assertCode(PRICE_FEED);
        if (keccak256(bytes(IMusd(MUSD).symbol())) != keccak256("MUSD")) revert UnexpectedDependency("MUSD symbol");
        if (IBorrowerOps(BORROWER_OPERATIONS).borrowerOperationsSignaturesAddress() != BORROWER_OPS_SIGNATURES) {
            revert UnexpectedDependency("BorrowerOperationsSignatures");
        }
        // PriceFeed.fetchPrice() is checked with a direct eth_call. Foundry's simulator
        // does not activate Mezo's oracle precompile, so this script only checks its code.
    }

    function _assertCode(address target) internal view {
        if (target.code.length == 0) revert MissingCode(target);
    }
}

interface IMusd {
    function symbol() external view returns (string memory);
}

interface IBorrowerOps {
    function borrowerOperationsSignaturesAddress() external view returns (address);
}
