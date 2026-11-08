// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeployV2Mainnet} from "../script/DeployV2Mainnet.s.sol";

/// @notice Read-only fork of Mezo mainnet. Skipped unless MEZO_MAINNET_RPC is set.
/// Does not deploy MUSD Pocket and does not broadcast.
contract MainnetPreflightTest is Test {
    function test_dependencies_on_live_mainnet() public {
        string memory rpc = vm.envOr("MEZO_MAINNET_RPC", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 31612);
        DeployV2Mainnet preflight = new DeployV2Mainnet();
        preflight.run();
        assertEq(address(0xEC03F758219746b6e773f107a05cF17b66E7D460).code.length, 0);
    }
}
