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

contract DeployScript is Script {
    uint96 constant ONE_USDC = 1_000_000;

    bytes constant KALI = hex"0f4c3d4c3d4c3d";
    bytes constant MERAPI = hex"0a45092a2b0d4c2c2c";

    struct Deployed {
        address usdc;
        TrackNFT tracks;
        PartNFT parts;
        Badge badge;
        DuckWekVault vault;
        DuckWekRace race;
    }

    function run() external returns (Deployed memory deployed) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.envAddress("OPERATOR");
        address treasury = vm.envAddress("TREASURY");
        address usdcAddress = vm.envOr("USDC", address(0));
        bool isMock = usdcAddress == address(0);
        bool welcomeEnabled = vm.envOr("WELCOME_ENABLED", isMock);
        bool lockArt = vm.envOr("LOCK_RENDERERS", false);
        address finalOwner = vm.envOr("FINAL_OWNER", address(0));

        vm.startBroadcast(deployerKey);
        if (isMock) usdcAddress = address(new MockUSDC(deployer));

        deployed.usdc = usdcAddress;
        deployed.tracks = new TrackNFT(deployer);
        deployed.parts = new PartNFT(deployer);
        deployed.badge = new Badge(deployer, address(deployed.tracks));
        deployed.vault =
            new DuckWekVault(deployer, usdcAddress, address(deployed.tracks), address(deployed.parts), treasury);
        deployed.race = new DuckWekRace(deployer, address(deployed.vault), address(deployed.badge));

        deployed.parts.setMinter(address(deployed.vault));
        deployed.badge.setMinter(address(deployed.race));
        if (isMock) {
            MockUSDC(usdcAddress).setVault(address(deployed.vault));
            MockUSDC(usdcAddress).mint(deployer, 1_000_000 * 1e6);
        }

        deployed.vault.setWelcomeEnabled(isMock && welcomeEnabled);
        deployed.vault.setOperator(operator, true);
        deployed.vault.setOperator(address(deployed.race), true);
        deployed.race.setOperator(operator, true);
        deployed.tracks.setOperator(operator, true);
        deployed.parts.setOperator(operator, true);

        deployed.parts.setRenderer(address(new PartRenderer()));
        deployed.tracks.setRenderer(address(new TrackRenderer()));
        deployed.badge.setRenderer(address(new BadgeRenderer()));

        _catalog(deployed, treasury);

        if (lockArt) {
            deployed.parts.lockRenderer();
            deployed.tracks.lockRenderer();
            deployed.badge.lockRenderer();
        }

        if (finalOwner != address(0)) {
            deployed.tracks.transferOwnership(finalOwner);
            deployed.parts.transferOwnership(finalOwner);
            deployed.badge.transferOwnership(finalOwner);
            deployed.vault.transferOwnership(finalOwner);
            deployed.race.transferOwnership(finalOwner);
        }

        vm.stopBroadcast();

        console.log("USDC=%s", usdcAddress);
        console.log("TRACK_NFT=%s", address(deployed.tracks));
        console.log("PART_NFT=%s", address(deployed.parts));
        console.log("BADGE=%s", address(deployed.badge));
        console.log("VAULT=%s", address(deployed.vault));
        console.log("RACE=%s", address(deployed.race));
        console.log("PART_RENDERER=%s", address(deployed.parts.renderer()));
        console.log("TRACK_RENDERER=%s", address(deployed.tracks.renderer()));
        console.log("BADGE_RENDERER=%s", address(deployed.badge.renderer()));
        console.log("MOCK=%s WELCOME=%s FINAL_OWNER=%s", isMock, welcomeEnabled, finalOwner);
    }

    function _catalog(Deployed memory deployed, address treasury) internal {
        deployed.tracks.createPlatformTrack(treasury, "Kali Code Sprint", KALI, 1);
        deployed.tracks.createPlatformTrack(treasury, "Merapi Ring", MERAPI, 2);

        bytes32[] memory statKeys = new bytes32[](3);
        statKeys[0] = "speed";
        statKeys[1] = "weight";
        statKeys[2] = "boost";
        deployed.parts.createPlatformPart(
            treasury, "Layangan Wings", ONE_USDC, 0, 0xFFFFFF, statKeys, _statValues(2, 0, -1)
        );
        deployed.parts.createPlatformPart(treasury, "Turbo Tail", ONE_USDC, 1, 0xFF9F1C, statKeys, _statValues(1, 1, 0));
        deployed.parts.createPlatformPart(treasury, "Iron Bill", ONE_USDC, 2, 0x9AA3B8, statKeys, _statValues(-1, 1, 2));
    }

    function _statValues(int8 speed, int8 weight, int8 boost) private pure returns (int8[] memory values) {
        values = new int8[](3);
        values[0] = speed;
        values[1] = weight;
        values[2] = boost;
    }
}
