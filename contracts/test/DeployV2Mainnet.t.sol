// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {DeployV2Mainnet} from "../script/DeployV2Mainnet.s.sol";
import {MUSDPocketV2} from "../src/MUSDPocketV2.sol";

contract DeployV2MainnetTest is Test {
    function test_runRejectsZeroOwner() public {
        vm.chainId(31612);
        vm.setEnv("POCKET_OWNER", "0x0000000000000000000000000000000000000000");
        DeployV2Mainnet script = new DeployV2Mainnet();
        vm.expectRevert(DeployV2Mainnet.OwnerRequired.selector);
        script.run();
    }

    function test_runRejectsWrongChainBeforeDeploy() public {
        vm.chainId(1);
        vm.setEnv("POCKET_OWNER", "0x1111111111111111111111111111111111111111");
        DeployV2Mainnet script = new DeployV2Mainnet();
        vm.expectRevert(abi.encodeWithSelector(DeployV2Mainnet.WrongChain.selector, 1, 31612));
        script.run();
    }

    /// @dev Local creation cost. A mainnet eth_estimateGas is recorded in docs/DEPLOY_MAINNET.md
    ///      when the dry-run RPC is reachable. This number is not a fee quote.
    function test_creationGas_isBounded() public {
        uint256 before = gasleft();
        new MUSDPocketV2(
            address(0x1),
            address(0x2),
            address(0x3),
            address(0x4),
            address(0x5)
        );
        uint256 used = before - gasleft();
        console2.log("creationGas", used);
        assertGt(used, 500_000);
        assertLt(used, 4_000_000);
    }
}
