// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract SmokeV2Script is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address player = vm.addr(key);
        DuckWekVault vault = DuckWekVault(vm.envAddress("VAULT"));
        PartNFT parts = PartNFT(vm.envAddress("PART_NFT"));
        MockUSDC usdc = MockUSDC(vm.envAddress("USDC"));

        uint256 deadline = block.timestamp + 1 days;
        uint256 cap = 5_000_000;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                player,
                address(vault),
                cap,
                usdc.nonces(player),
                deadline
            )
        );
        (uint8 recoveryId, bytes32 signatureR, bytes32 signatureS) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
        DuckWekVault.Permit memory permit = DuckWekVault.Permit(cap, deadline, recoveryId, signatureR, signatureS);

        vm.startBroadcast(key);
        for (uint256 typeId; typeId < 3; ++typeId) {
            if (parts.licenseOf(player, typeId) != 0) continue;

            DuckWekVault.Order memory order = DuckWekVault.Order(
                player,
                3,
                typeId,
                bytes32(0),
                DuckWekVault.Loadout(0, [type(uint16).max, type(uint16).max, type(uint16).max]),
                1_000_000,
                uint256(keccak256(abi.encode("smoke", typeId)))
            );
            uint256 tokenId = _spend(vault, order, permit, typeId);
            console.log("licence token %s for part type %s", tokenId, typeId);
        }

        vm.stopBroadcast();
    }

    function _spend(
        DuckWekVault vault,
        DuckWekVault.Order memory order,
        DuckWekVault.Permit memory permit,
        uint256 typeId
    ) internal returns (uint256) {
        return typeId == 0 ? vault.permitAndSpend(order, permit) : vault.spend(order);
    }
}
