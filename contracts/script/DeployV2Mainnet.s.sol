// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

/// @notice Read-only Mezo mainnet preflight. `run` does not broadcast.
/// Chain id 31612 is Mezo mainnet in the developer getting-started guide.
/// No sponsorship for deployment gas was found in Mezo's public docs.
/// This file does not ask for a private key and does not spend BTC.
contract DeployV2Mainnet is Script {
    uint256 constant MEZO_MAINNET = 31612;
    address constant MUSD = 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186;
    address constant BORROWER_OPERATIONS = 0x44b1bac67dDA612a41a58AAf779143B181dEe031;
    address constant BORROWER_OPS_SIGNATURES = 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a;
    address constant TROVE_MANAGER = 0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193;
    address constant PRICE_FEED = 0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88;

    error WrongChain(uint256 actual, uint256 expected);
    error MissingCode(address target);
    error UnexpectedDependency(string what);

    function run() external view {
        if (block.chainid != MEZO_MAINNET) revert WrongChain(block.chainid, MEZO_MAINNET);
        _assertDependencies();
        console2.log("Preflight only. No transaction.");
        console2.log("chainId", block.chainid);
        console2.log("MUSD", MUSD);
        console2.log("BorrowerOperations", BORROWER_OPERATIONS);
        console2.log("BorrowerOperationsSignatures", BORROWER_OPS_SIGNATURES);
        console2.log("TroveManager", TROVE_MANAGER);
        console2.log("PriceFeed", PRICE_FEED);
        console2.log("initial earlyFeeBps", uint256(200));
        console2.log("max earlyFeeBps", uint256(500));
        console2.log("No proxy admin. Owner would be the deploying address, which is not chosen here.");
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
