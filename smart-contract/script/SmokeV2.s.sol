// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// Testnet rehearsal helper: the signer buys the three platform parts with ONE permit (the session), so real licences exist
/// on chain and the NFT art can be read back. The signer must be an operator of the Vault and hold the mock USDC.
/// forge script script/SmokeV2.s.sol --rpc-url $RPC_URL --broadcast
/// Env: PRIVATE_KEY, VAULT, PART_NFT, USDC.
contract SmokeV2Script is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(key);
        DuckWekVault vault = DuckWekVault(vm.envAddress("VAULT"));
        PartNFT parts = PartNFT(vm.envAddress("PART_NFT"));
        MockUSDC usdc = MockUSDC(vm.envAddress("USDC"));

        uint256 deadline = block.timestamp + 1 days;
        uint256 cap = 5_000_000;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                me, address(vault), cap, usdc.nonces(me), deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
        DuckWekVault.Permit memory p = DuckWekVault.Permit(cap, deadline, v, r, s);

        vm.startBroadcast(key);
        for (uint256 t; t < 3; ++t) {
            if (parts.licenseOf(me, t) != 0) continue; // one licence per type per wallet
            DuckWekVault.Order memory o = DuckWekVault.Order(
                me, 3, t, bytes32(0), DuckWekVault.Loadout(0, [type(uint16).max, type(uint16).max, type(uint16).max]), 1_000_000, uint256(keccak256(abi.encode("smoke", t)))
            );
            uint256 id = (t == 0 || parts.licenseOf(me, t - 1) != 0 || true) ? _spend(vault, o, p, t) : 0;
            console.log("licence token %s for part type %s", id, t);
        }
        vm.stopBroadcast();
    }

    /// The first order carries the permit, the others ride the same session.
    function _spend(DuckWekVault vault, DuckWekVault.Order memory o, DuckWekVault.Permit memory p, uint256 t) internal returns (uint256) {
        return t == 0 ? vault.permitAndSpend(o, p) : vault.spend(o);
    }
}
