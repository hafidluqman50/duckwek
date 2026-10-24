// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {DuckNFT} from "../src/DuckNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRace} from "../src/DuckWekRace.sol";

/// Deploys the fixed contracts against the real USDC on Monad mainnet.
/// The Vault trusts the token address it is constructed with, so the token is checked here, before deployment:
/// code exists, 6 decimals, symbol "USDC", and EIP-2612 permit is present. The canonical address itself must come
/// from the official Monad docs and be checked on the explorer; this script proves the token shape, not the issuer.
/// Welcome mint is always disabled on mainnet.
contract DeployMainnetScript is Script {
    uint96 constant ONE_USDC = 1_000_000;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.envAddress("OPERATOR");
        address treasury = vm.envAddress("TREASURY");
        address usdc = vm.envAddress("USDC");

        require(usdc.code.length > 0, "USDC: no code at the address");
        require(IERC20Metadata(usdc).decimals() == 6, "USDC: decimals must be 6");
        require(keccak256(bytes(IERC20Metadata(usdc).symbol())) == keccak256("USDC"), "USDC: symbol must be USDC");
        IERC20Permit(usdc).DOMAIN_SEPARATOR(); // reverts if the token has no EIP-2612
        IERC20Permit(usdc).nonces(address(0)); // reverts if the token has no EIP-2612 nonces

        vm.startBroadcast(deployerKey);

        TrackNFT tracks = new TrackNFT(deployer);
        PartNFT parts = new PartNFT(deployer);
        DuckNFT ducks = new DuckNFT(deployer);
        Badge badge = new Badge(deployer);
        DuckWekVault vault = new DuckWekVault(deployer, usdc, address(tracks), address(parts), treasury);
        DuckWekRace race = new DuckWekRace(deployer, address(vault), address(badge));

        parts.setMinter(address(vault));
        badge.setMinter(address(race));
        vault.setWelcomeEnabled(false); // real USDC has no welcome mint
        vault.setOperator(operator, true);
        vault.setOperator(address(race), true);
        race.setOperator(operator, true);
        ducks.setOperator(operator, true);

        tracks.createPlatformTrack(treasury, "Kali Code Sprint", ONE_USDC, 1, 6, 1_800);
        tracks.createPlatformTrack(treasury, "Alpine Ring", ONE_USDC, 2, 10, 4_326);
        parts.createPlatformPart(treasury, "Buroq Wings", ONE_USDC, 2, 0, -1);
        parts.createPlatformPart(treasury, "Turbo Tail", ONE_USDC, 1, 1, 0);
        parts.createPlatformPart(treasury, "Iron Bill", ONE_USDC, -1, 1, 2);

        vm.stopBroadcast();

        console.log("USDC=%s", usdc);
        console.log("TRACK_NFT=%s", address(tracks));
        console.log("PART_NFT=%s", address(parts));
        console.log("DUCK_NFT=%s", address(ducks));
        console.log("BADGE=%s", address(badge));
        console.log("VAULT=%s", address(vault));
        console.log("RACE=%s", address(race));
    }
}
