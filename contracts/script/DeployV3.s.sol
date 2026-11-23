// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MUSDPocketV3} from "../src/MUSDPocketV3.sol";
import {PocketTimelock} from "../src/PocketTimelock.sol";

/// @notice Deploy MUSD Pocket v3 on Mezo TESTNET (chain 31611).
/// @dev PRIVATE_KEY must be a testnet-only key. POCKET_ADMIN is required; a PocketTimelock (2-day delay by default) is deployed first and owns the Pocket.
///      Addresses: MUSD from the Mezo contracts reference; protocol proxies from the
///      mezo-org/musd testnet deployment, checked on-chain; sMUSD = PCV.feeRecipient()
///      (PCV = TroveManager.pcv() = 0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af).
///      Set SAVINGS_VAULT=0x0000000000000000000000000000000000000000 to deploy with earn mode off.
contract DeployV3 is Script {
    uint256 constant MEZO_TESTNET = 31611;
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BORROWER_OPERATIONS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant BORROWER_OPS_SIGNATURES = 0xD757e3646AF370b15f32EB557F0F8380Df7D639e;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant SMUSD = 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16;

    error WrongChain(uint256 actual);
    error OwnerRequired();

    function run() external {
        if (block.chainid != MEZO_TESTNET) revert WrongChain(block.chainid);
        uint256 pk = vm.envUint("PRIVATE_KEY");
        // POCKET_ADMIN queues admin calls on the timelock; the timelock owns the Pocket.
        address timelockAdmin = vm.envAddress("POCKET_ADMIN");
        if (timelockAdmin == address(0)) revert OwnerRequired();
        uint256 delay = vm.envOr("TIMELOCK_DELAY", uint256(2 days));
        address vault = vm.envOr("SAVINGS_VAULT", SMUSD);

        vm.startBroadcast(pk);
        PocketTimelock timelock = new PocketTimelock(timelockAdmin, delay);
        address pocketOwner = address(timelock);
        MUSDPocketV3 pocket = new MUSDPocketV3(
            MUSDPocketV3.Config({
                musd: MUSD,
                borrowerOperations: BORROWER_OPERATIONS,
                borrowerOperationsSignatures: BORROWER_OPS_SIGNATURES,
                troveManager: TROVE_MANAGER,
                priceFeed: PRICE_FEED,
                savingsVault: vault,
                owner: pocketOwner
            })
        );
        vm.stopBroadcast();
        console2.log("MUSDPocketV3", address(pocket));
        console2.log("savingsVault", vault);
        console2.log("PocketTimelock (owner)", address(timelock));
    }
}
