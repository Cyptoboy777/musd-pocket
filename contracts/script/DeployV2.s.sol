// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

/// @notice Deploy MUSD Pocket v2 on Mezo testnet, wired to the live MUSD protocol.
/// @dev The verified testnet contract is already at 0xEC03F758219746b6e773f107a05cF17b66E7D460
///      (git 2c5bd9b). Do not broadcast this script unless a new testnet deployment is intended.
///      POCKET_OWNER is required and should be a multisig. The deployer key is not the owner.
///      Testnet MUSD: https://mezo.org/docs/users/resources/contracts-reference/
///      Protocol addresses were read from the mezo-org/musd testnet deployment and checked
///      on-chain (BorrowerOperations.borrowerOperationsSignaturesAddress()).
contract DeployV2 is Script {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BORROWER_OPS_SIGNATURES = 0xD757e3646AF370b15f32EB557F0F8380Df7D639e;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;

    error OwnerRequired();

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address pocketOwner = vm.envAddress("POCKET_OWNER");
        if (pocketOwner == address(0)) revert OwnerRequired();
        console2.log("Deployer:", deployer);
        console2.log("Owner:", pocketOwner);

        vm.startBroadcast(pk);
        MUSDPocketV2 pocket = new MUSDPocketV2(MUSD, BORROWER_OPS_SIGNATURES, TROVE_MANAGER, PRICE_FEED, pocketOwner);
        vm.stopBroadcast();

        console2.log("MUSDPocketV2:", address(pocket));
    }
}
