// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRace} from "../src/DuckWekRace.sol";

/// Read-only post-deploy check (plan 0013 DoD 7). Reads every role, minter, operator, renderer, catalog entry and price
/// from the chain and reverts on the first mismatch with the expected configuration. It sends no transaction.
///
/// forge script script/CheckDeploy.s.sol --rpc-url $RPC_URL
/// Env: VAULT, RACE, PART_NFT, TRACK_NFT, BADGE, USDC, OPERATOR, TREASURY, EXPECTED_OWNER (the deployer on testnet, the Safe on mainnet).
contract CheckDeployScript is Script {
    bytes constant KALI = hex"0f4c3d4c3d4c3d";
    bytes constant MERAPI = hex"0a45092a2b0d4c2c2c";

    function run() external view {
        DuckWekVault vault = DuckWekVault(vm.envAddress("VAULT"));
        DuckWekRace race = DuckWekRace(vm.envAddress("RACE"));
        PartNFT parts = PartNFT(vm.envAddress("PART_NFT"));
        TrackNFT tracks = TrackNFT(vm.envAddress("TRACK_NFT"));
        Badge badge = Badge(vm.envAddress("BADGE"));
        address operator = vm.envAddress("OPERATOR");
        address treasury = vm.envAddress("TREASURY");
        address expectedOwner = vm.envAddress("EXPECTED_OWNER");

        // wiring
        require(address(vault.tracks()) == address(tracks), "vault.tracks");
        require(address(vault.parts()) == address(parts), "vault.parts");
        require(address(vault.usdc()) == vm.envAddress("USDC"), "vault.usdc");
        require(address(race.vault()) == address(vault), "race.vault");
        require(address(race.badge()) == address(badge), "race.badge");
        require(address(badge.tracks()) == address(tracks), "badge.tracks");
        require(vault.treasury() == treasury, "treasury");

        // owners (Ownable2Step: a pending transfer must have been accepted)
        require(vault.owner() == expectedOwner, "vault owner");
        require(race.owner() == expectedOwner, "race owner");
        require(parts.owner() == expectedOwner, "parts owner");
        require(tracks.owner() == expectedOwner, "tracks owner");
        require(badge.owner() == expectedOwner, "badge owner");

        // operators
        require(vault.isOperator(operator), "vault operator");
        require(vault.isOperator(address(race)), "race is a vault operator");
        require(race.isOperator(operator), "race operator");
        require(tracks.isOperator(operator), "tracks operator");
        require(parts.isOperator(operator), "parts operator");

        // set-once minters and renderers
        require(parts.minter() == address(vault), "parts minter");
        require(badge.minter() == address(race), "badge minter");
        require(address(parts.renderer()) != address(0), "parts renderer");
        require(address(tracks.renderer()) != address(0), "tracks renderer");
        require(address(badge.renderer()) != address(0), "badge renderer");

        // prices and limits
        require(vault.joinPrice() == 100_000, "join price");
        require(vault.MAX_EQUIPPED() == 1, "max equipped");
        require(!vault.paused() && !race.paused(), "paused");

        _tracks(tracks, treasury);
        _parts(parts, treasury);

        // art must answer for every catalog entry
        require(bytes(tracks.tokenURI(1)).length > 0 && bytes(tracks.tokenURI(2)).length > 0, "track art");
        console.log("CheckDeploy: OK");
    }

    function _tracks(TrackNFT tracks, address treasury) internal view {
        require(tracks.nextId() == 3, "tracks count");
        _track(tracks, 1, "Kali Code Sprint", KALI, 1, treasury);
        _track(tracks, 2, "Merapi Ring", MERAPI, 2, treasury);
    }

    function _track(TrackNFT tracks, uint256 id, string memory name, bytes memory seg, uint16 laps, address treasury) internal view {
        TrackNFT.Track memory t = tracks.track(id);
        require(keccak256(bytes(t.name)) == keccak256(bytes(name)), "track name");
        require(t.platform && t.active && t.version == 1 && t.editsUsed == 0, "track flags");
        require(tracks.ownerOf(id) == treasury, "track holder");
        require(tracks.rentOf(id) == 1_000_000, "track rent");
        (bytes memory s, uint16 l) = tracks.layoutOf(id, 1);
        require(keccak256(s) == keccak256(seg) && l == laps, "track layout");
    }

    function _parts(PartNFT parts, address treasury) internal view {
        require(parts.typeCount() == 3, "part count");
        require(parts.statCount() == 3, "stat count");
        _part(parts, 0, "Layangan Wings", 0, 0xFFFFFF, 2, 0, -1, treasury);
        _part(parts, 1, "Turbo Tail", 1, 0xFF9F1C, 1, 1, 0, treasury);
        _part(parts, 2, "Iron Bill", 2, 0x9AA3B8, -1, 1, 2, treasury);
    }

    function _part(PartNFT parts, uint256 id, string memory name, uint8 slot, uint24 color, int8 s, int8 w, int8 b, address treasury)
        internal
        view
    {
        PartNFT.PartType memory p = parts.partType(id);
        require(keccak256(bytes(p.name)) == keccak256(bytes(name)), "part name");
        require(p.slot == slot && p.color == color && p.price == 1_000_000, "part fields");
        require(p.creator == treasury && p.platform && p.active, "part owner");
        require(parts.statOf(id, "speed") == s && parts.statOf(id, "weight") == w && parts.statOf(id, "boost") == b, "part stats");
    }
}
