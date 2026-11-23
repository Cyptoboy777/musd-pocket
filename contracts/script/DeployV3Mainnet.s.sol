// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV3} from "../src/MUSDPocketV3.sol";
import {PocketTimelock} from "../src/PocketTimelock.sol";

/// @notice Mezo MAINNET (31612) preflight and deploy for MUSD Pocket v3.
/// @dev This file holds no key and no default owner. The recommended path is the in-app
///      deploy page (/deploy-tool on a preview build), which sends the same creation
///      transaction from your own MetaMask. From a terminal, use a hardware wallet or
///      `--interactives 1`; never paste a key into a file.
///
///      Sources
///      - MUSD: https://mezo.org/docs/users/resources/contracts-reference/
///      - BorrowerOperations / BorrowerOperationsSignatures / TroveManager / PriceFeed:
///        https://github.com/mezo-org/musd/releases/tag/v1.1.0 (proxies)
///      - MUSD Savings Vault (sMUSD): 0xb4D4…51CC, listed in mezo-org/documentation
///        (vault-notices.md) and equal to PCV.feeRecipient() on mainnet. Checked below.
contract DeployV3Mainnet is Script {
    uint256 constant MEZO_MAINNET = 31612;
    address constant MUSD = 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186;
    address constant BORROWER_OPERATIONS = 0x44b1bac67dDA612a41a58AAf779143B181dEe031;
    address constant BORROWER_OPS_SIGNATURES = 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a;
    address constant TROVE_MANAGER = 0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193;
    address constant PRICE_FEED = 0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88;
    address constant SMUSD = 0xb4D498029af77680cD1eF828b967f010d06C51CC;

    error WrongChain(uint256 actual, uint256 expected);
    error MissingCode(address target);
    error UnexpectedDependency(string what);
    error OwnerRequired();

    function config(address pocketOwner) public pure returns (MUSDPocketV3.Config memory) {
        return MUSDPocketV3.Config({
            musd: MUSD,
            borrowerOperations: BORROWER_OPERATIONS,
            borrowerOperationsSignatures: BORROWER_OPS_SIGNATURES,
            troveManager: TROVE_MANAGER,
            priceFeed: PRICE_FEED,
            savingsVault: SMUSD,
            owner: pocketOwner
        });
    }

    /// @notice Read-only. No transaction.
    function preflight() external view {
        if (block.chainid != MEZO_MAINNET) revert WrongChain(block.chainid, MEZO_MAINNET);
        _assertDependencies();
        console2.log("Preflight OK. No transaction sent.");
    }

    /// @notice Simulated unless you add --broadcast with your own signer.
    function run() external {
        address timelockAdmin = vm.envAddress("POCKET_ADMIN");
        if (timelockAdmin == address(0)) revert OwnerRequired();
        if (block.chainid != MEZO_MAINNET) revert WrongChain(block.chainid, MEZO_MAINNET);
        _assertDependencies();
        vm.startBroadcast();
        PocketTimelock timelock = new PocketTimelock(timelockAdmin, 2 days);
        address pocketOwner = address(timelock);
        MUSDPocketV3 pocket = new MUSDPocketV3(config(pocketOwner));
        vm.stopBroadcast();
        console2.log("MUSDPocketV3", address(pocket));
        console2.log("owner (PocketTimelock, 2-day delay)", pocketOwner);
        console2.log("timelock admin", timelockAdmin);
    }

    function _assertDependencies() internal view {
        address[6] memory deps = [MUSD, BORROWER_OPERATIONS, BORROWER_OPS_SIGNATURES, TROVE_MANAGER, PRICE_FEED, SMUSD];
        for (uint256 i; i < deps.length; i++) {
            if (deps[i].code.length == 0) revert MissingCode(deps[i]);
        }
        if (IBO(BORROWER_OPERATIONS).borrowerOperationsSignaturesAddress() != BORROWER_OPS_SIGNATURES) {
            revert UnexpectedDependency("BorrowerOperationsSignatures");
        }
        if (IVault(SMUSD).musdToken() != MUSD) revert UnexpectedDependency("sMUSD asset");
        address pcv = ITM(TROVE_MANAGER).pcv();
        if (IPCV(pcv).feeRecipient() != SMUSD) revert UnexpectedDependency("sMUSD is not PCV fee recipient");
        if (IBO(BORROWER_OPERATIONS).minNetDebt() == 0) revert UnexpectedDependency("minNetDebt");
    }
}

interface IBO {
    function borrowerOperationsSignaturesAddress() external view returns (address);
    function minNetDebt() external view returns (uint256);
}

interface IVault {
    function musdToken() external view returns (address);
}

interface ITM {
    function pcv() external view returns (address);
}

interface IPCV {
    function feeRecipient() external view returns (address);
}
