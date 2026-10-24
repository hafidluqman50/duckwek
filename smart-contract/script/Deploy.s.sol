// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {DuckNFT} from "../src/DuckNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRace} from "../src/DuckWekRace.sol";

/// Deploys the paid on-chain race. The deployer (PRIVATE_KEY) owns every contract.
/// The relayer (OPERATOR) is only an operator: it submits the player's permit and charges orders under it, and pays gas.
/// It cannot move funds out of the Vault. The platform circuits and parts are owned by TREASURY (the protocol address), so
/// the one owner / protocol split rule credits the protocol alone.
/// forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
contract DeployScript is Script {
    uint96 constant ONE_USDC = 1_000_000;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.envAddress("OPERATOR");
        address treasury = vm.envAddress("TREASURY");

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC(deployer);
        TrackNFT tracks = new TrackNFT(deployer);
        PartNFT parts = new PartNFT(deployer);
        DuckNFT ducks = new DuckNFT(deployer);
        Badge badge = new Badge(deployer);
        DuckWekVault vault = new DuckWekVault(deployer, address(usdc), address(tracks), address(parts), treasury);
        DuckWekRace race = new DuckWekRace(deployer, address(vault), address(badge));

        parts.setMinter(address(vault));
        badge.setMinter(address(race));
        usdc.setVault(address(vault)); // mock token only: the Vault mints the welcome USDC in a wallet's first order
        vault.setWelcomeEnabled(true);
        vault.setOperator(operator, true);
        vault.setOperator(address(race), true); // the race charges rent and tickets through the Vault
        race.setOperator(operator, true);
        ducks.setOperator(operator, true);

        // Platform tracks, owned by the treasury: create room = track rent (1 USDC), join = ticket (0.10 USDC).
        tracks.createPlatformTrack(treasury, "Kali Code Sprint", ONE_USDC, 1, 6, 1_800); // id 1
        tracks.createPlatformTrack(treasury, "Alpine Ring", ONE_USDC, 2, 10, 4_326); // id 2

        // Platform parts, owned by the treasury: 1 USDC each. Trade-offs: none wins on every track.
        parts.createPlatformPart(treasury, "Buroq Wings", ONE_USDC, 2, 0, -1);
        parts.createPlatformPart(treasury, "Turbo Tail", ONE_USDC, 1, 1, 0);
        parts.createPlatformPart(treasury, "Iron Bill", ONE_USDC, -1, 1, 2);

        usdc.mint(deployer, 1_000_000 * 1e6); // 1,000,000 USDC to the owner wallet

        vm.stopBroadcast();

        console.log("MOCK_USDC=%s", address(usdc));
        console.log("TRACK_NFT=%s", address(tracks));
        console.log("PART_NFT=%s", address(parts));
        console.log("DUCK_NFT=%s", address(ducks));
        console.log("BADGE=%s", address(badge));
        console.log("VAULT=%s", address(vault));
        console.log("RACE=%s", address(race));
    }
}
