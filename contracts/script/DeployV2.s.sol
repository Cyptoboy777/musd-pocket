// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

/// @notice Deploy MUSD Pocket v2 on Mezo testnet, wired to the live MUSD protocol.
/// Addresses: github.com/mezo-org/musd deployments, checked on-chain (BorrowerOperations
/// .borrowerOperationsSignaturesAddress(), HintHelpers.sortedTroves(), etc.).
contract DeployV2 is Script {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BORROWER_OPS_SIGNATURES = 0xD757e3646AF370b15f32EB557F0F8380Df7D639e;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        console2.log("Deployer:", deployer);

        vm.startBroadcast(pk);
        MUSDPocketV2 pocket = new MUSDPocketV2(MUSD, BORROWER_OPS_SIGNATURES, TROVE_MANAGER, PRICE_FEED, deployer);
        vm.stopBroadcast();

        console2.log("MUSDPocketV2:", address(pocket));
    }
}
