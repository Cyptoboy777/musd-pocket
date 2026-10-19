// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocket} from "../src/MUSDPocket.sol";

/// @notice Deploy MUSDPocket on Mezo testnet against canonical MUSD.
contract Deploy is Script {
    // Mezo testnet MUSD: https://mezo.org/docs/users/resources/contracts-reference/
    address constant MUSD_TESTNET = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;

    function run() external {
        address musd = vm.envOr("MUSD_TOKEN", MUSD_TESTNET);
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console2.log("Deployer:", deployer);
        console2.log("MUSD:", musd);

        vm.startBroadcast(pk);
        MUSDPocket pocket = new MUSDPocket(musd, deployer);
        vm.stopBroadcast();

        console2.log("MUSDPocket:", address(pocket));
    }
}
