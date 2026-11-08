// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

/// @notice Mezo mainnet deploy script. This repository does not run it.
/// Chain id 31612 is Mezo mainnet in https://mezo.org/docs/developers/getting-started/
/// and was rechecked with eth_chainId on https://mezo.drpc.org.
/// Broadcast only with an encrypted keystore (`--account`) or a hardware wallet.
/// Do not pass a raw private key on the command line.
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

    function run() external {
        if (block.chainid != MEZO_MAINNET) revert WrongChain(block.chainid, MEZO_MAINNET);
        _assertDependencies();

        address deployer = vm.envAddress("DEPLOYER");
        vm.startBroadcast(deployer);
        MUSDPocketV2 pocket = new MUSDPocketV2(MUSD, BORROWER_OPS_SIGNATURES, TROVE_MANAGER, PRICE_FEED, deployer);
        vm.stopBroadcast();
        console2.log("MUSDPocketV2:", address(pocket));
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
        if (IPriceFeed(PRICE_FEED).fetchPrice() == 0) revert UnexpectedDependency("PriceFeed");
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

interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}
