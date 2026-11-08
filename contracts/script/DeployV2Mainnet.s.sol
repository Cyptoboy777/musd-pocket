// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

/// @notice Mezo mainnet deploy script. This repository does not run it.
/// Simulation uses DEPLOYER and does not broadcast. A real deploy needs a
/// separate approval, mainnet BTC for gas, and a key that stays off this repo.
/// Addresses checked against mezo.org docs and public mainnet reads (chain 31612).
contract DeployV2Mainnet is Script {
    address constant MUSD = 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186;
    address constant BORROWER_OPS_SIGNATURES = 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a;
    address constant TROVE_MANAGER = 0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193;
    address constant PRICE_FEED = 0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk == 0) {
            address deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
            MUSDPocketV2 pocket = new MUSDPocketV2(MUSD, BORROWER_OPS_SIGNATURES, TROVE_MANAGER, PRICE_FEED, deployer);
            vm.stopBroadcast();
            console2.log("Simulated MUSDPocketV2:", address(pocket));
            return;
        }
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        MUSDPocketV2 pocket = new MUSDPocketV2(MUSD, BORROWER_OPS_SIGNATURES, TROVE_MANAGER, PRICE_FEED, deployer);
        vm.stopBroadcast();
        console2.log("MUSDPocketV2:", address(pocket));
    }
}
