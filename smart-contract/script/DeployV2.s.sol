// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRace} from "../src/DuckWekRace.sol";
import {PartRenderer} from "../src/render/PartRenderer.sol";
import {TrackRenderer} from "../src/render/TrackRenderer.sol";
import {BadgeRenderer} from "../src/render/BadgeRenderer.sol";

/// Plan 0013 v2 deploy. Order (G10): Badge -> parts -> tracks -> Vault -> Race -> set-once minters -> renderers -> catalog.
/// The deployer (PRIVATE_KEY) owns every contract while it is configured. If FINAL_OWNER is set, ownership is offered to it
/// last (Ownable2Step: it must call `acceptOwnership`), which is how the mainnet Safe takes over (plan 0013 D8).
///
/// Testnet (staging):  forge script script/DeployV2.s.sol --rpc-url $RPC_URL --broadcast
/// Env: PRIVATE_KEY, OPERATOR, TREASURY; optional USDC (existing token; otherwise a MockUSDC is deployed),
///      WELCOME_ENABLED (default true when a mock is deployed), FINAL_OWNER, LOCK_RENDERERS (default false).
contract DeployV2Script is Script {
    uint96 constant ONE_USDC = 1_000_000;

    bytes constant KALI = hex"0f4c3d4c3d4c3d"; // river sprint: 6 turns, 1800 m, open
    bytes constant MERAPI = hex"0a45092a2b0d4c2c2c"; // original closed circuit: 6 turns, 1880 m

    struct Deployed {
        address usdc;
        TrackNFT tracks;
        PartNFT parts;
        Badge badge;
        DuckWekVault vault;
        DuckWekRace race;
    }

    function run() external returns (Deployed memory d) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.envAddress("OPERATOR");
        address treasury = vm.envAddress("TREASURY");
        address usdcAddr = vm.envOr("USDC", address(0));
        bool mock = usdcAddr == address(0);
        bool welcome = vm.envOr("WELCOME_ENABLED", mock);
        bool lockArt = vm.envOr("LOCK_RENDERERS", false);
        address finalOwner = vm.envOr("FINAL_OWNER", address(0));

        vm.startBroadcast(deployerKey);
        if (mock) usdcAddr = address(new MockUSDC(deployer));
        d.usdc = usdcAddr;
        d.tracks = new TrackNFT(deployer);
        d.parts = new PartNFT(deployer);
        d.badge = new Badge(deployer, address(d.tracks));
        d.vault = new DuckWekVault(deployer, usdcAddr, address(d.tracks), address(d.parts), treasury);
        d.race = new DuckWekRace(deployer, address(d.vault), address(d.badge));

        d.parts.setMinter(address(d.vault)); // set once
        d.badge.setMinter(address(d.race)); // set once
        if (mock) {
            MockUSDC(usdcAddr).setVault(address(d.vault)); // the Vault mints the welcome USDC in a wallet's first order
            MockUSDC(usdcAddr).mint(deployer, 1_000_000 * 1e6);
        }
        d.vault.setWelcomeEnabled(mock && welcome);
        d.vault.setOperator(operator, true);
        d.vault.setOperator(address(d.race), true); // the race charges rent and tickets through the Vault
        d.race.setOperator(operator, true);
        d.tracks.setOperator(operator, true); // creator circuits and layouts are published by the operator after review
        d.parts.setOperator(operator, true);

        d.parts.setRenderer(address(new PartRenderer()));
        d.tracks.setRenderer(address(new TrackRenderer()));
        d.badge.setRenderer(address(new BadgeRenderer()));

        _catalog(d, treasury);

        if (lockArt) {
            d.parts.lockRenderer();
            d.tracks.lockRenderer();
            d.badge.lockRenderer();
        }
        if (finalOwner != address(0)) {
            d.tracks.transferOwnership(finalOwner);
            d.parts.transferOwnership(finalOwner);
            d.badge.transferOwnership(finalOwner);
            d.vault.transferOwnership(finalOwner);
            d.race.transferOwnership(finalOwner);
        }
        vm.stopBroadcast();

        console.log("USDC=%s", usdcAddr);
        console.log("TRACK_NFT=%s", address(d.tracks));
        console.log("PART_NFT=%s", address(d.parts));
        console.log("BADGE=%s", address(d.badge));
        console.log("VAULT=%s", address(d.vault));
        console.log("RACE=%s", address(d.race));
        console.log("PART_RENDERER=%s", address(d.parts.renderer()));
        console.log("TRACK_RENDERER=%s", address(d.tracks.renderer()));
        console.log("BADGE_RENDERER=%s", address(d.badge.renderer()));
        console.log("MOCK=%s WELCOME=%s FINAL_OWNER=%s", mock, welcome, finalOwner);
    }

    /// Ids come from this order only (never from the v1 catalog, G11): tracks 1 Kali Code Sprint, 2 Merapi Ring;
    /// parts 0 Layangan Wings, 1 Turbo Tail, 2 Iron Bill. All are owned by the treasury, so the one split rule credits it alone.
    function _catalog(Deployed memory d, address treasury) internal {
        d.tracks.createPlatformTrack(treasury, "Kali Code Sprint", KALI, 1);
        d.tracks.createPlatformTrack(treasury, "Merapi Ring", MERAPI, 2);

        bytes32[] memory k = new bytes32[](3);
        k[0] = "speed";
        k[1] = "weight";
        k[2] = "boost";
        d.parts.createPlatformPart(treasury, "Layangan Wings", ONE_USDC, 0, 0xFFFFFF, k, _v(2, 0, -1));
        d.parts.createPlatformPart(treasury, "Turbo Tail", ONE_USDC, 1, 0xFF9F1C, k, _v(1, 1, 0));
        d.parts.createPlatformPart(treasury, "Iron Bill", ONE_USDC, 2, 0x9AA3B8, k, _v(-1, 1, 2));
    }

    function _v(int8 a, int8 b, int8 c) private pure returns (int8[] memory v) {
        v = new int8[](3);
        v[0] = a;
        v[1] = b;
        v[2] = c;
    }
}
