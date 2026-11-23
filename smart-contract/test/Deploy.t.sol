// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DeployScript} from "../script/Deploy.s.sol";
import {CheckDeployScript} from "../script/CheckDeploy.s.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {PartNFT} from "../src/PartNFT.sol";

contract DeployTest is Test {
    address deployer;
    address operator = address(0x0E);
    address treasury = address(0x7E);

    function _deploy(address finalOwner) internal returns (DeployScript.Deployed memory deployed) {
        uint256 key = 0xDE91;
        deployer = vm.addr(key);
        vm.setEnv("PRIVATE_KEY", vm.toString(bytes32(key)));
        vm.setEnv("OPERATOR", vm.toString(operator));
        vm.setEnv("TREASURY", vm.toString(treasury));
        vm.setEnv("FINAL_OWNER", vm.toString(finalOwner));
        deployed = new DeployScript().run();
        vm.setEnv("VAULT", vm.toString(address(deployed.vault)));
        vm.setEnv("RACE", vm.toString(address(deployed.race)));
        vm.setEnv("PART_NFT", vm.toString(address(deployed.parts)));
        vm.setEnv("TRACK_NFT", vm.toString(address(deployed.tracks)));
        vm.setEnv("BADGE", vm.toString(address(deployed.badge)));
        vm.setEnv("USDC", vm.toString(deployed.usdc));
        vm.setEnv("EXPECTED_OWNER", vm.toString(finalOwner == address(0) ? deployer : finalOwner));
    }

    function test_run_deployAndCheckScenarios() public {
        DeployScript.Deployed memory deployed = _deploy(address(0));
        new CheckDeployScript().run();

        vm.prank(deployer);
        deployed.vault.setOperator(operator, false);
        CheckDeployScript checker = new CheckDeployScript();
        vm.expectRevert(bytes("vault operator"));
        checker.run();

        address safe = address(0x5AFE);
        deployed = _deploy(safe);
        checker = new CheckDeployScript();
        vm.expectRevert(bytes("vault owner"));
        checker.run();

        vm.startPrank(safe);
        deployed.vault.acceptOwnership();
        deployed.race.acceptOwnership();
        deployed.parts.acceptOwnership();
        deployed.tracks.acceptOwnership();
        deployed.badge.acceptOwnership();
        vm.stopPrank();
        new CheckDeployScript().run();
    }

    function test_run_freshDeployServesFullOrderFlow() public {
        DeployScript.Deployed memory deployed = _deploy(address(0));
        uint256 playerKey = 0xBEEF;
        address player = vm.addr(playerKey);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                player,
                address(deployed.vault),
                uint256(5_000_000),
                uint256(0),
                deadline
            )
        );
        (uint8 recoveryId, bytes32 signatureR, bytes32 signatureS) =
            vm.sign(playerKey, keccak256(abi.encodePacked("\x19\x01", _domain(deployed.usdc), structHash)));
        DuckWekVault.Order memory order = DuckWekVault.Order(
            player,
            3,
            0,
            bytes32(0),
            DuckWekVault.Loadout(0, [type(uint16).max, type(uint16).max, type(uint16).max]),
            1_000_000,
            1
        );
        vm.prank(operator);
        uint256 tokenId = deployed.vault.permitAndSpend(
            order, DuckWekVault.Permit(5_000_000, deadline, recoveryId, signatureR, signatureS)
        );
        assertEq(deployed.parts.ownerOf(tokenId), player);
        assertGt(bytes(deployed.parts.tokenURI(tokenId)).length, 1000);
    }

    function _domain(address token) internal view returns (bytes32) {
        (bool succeeded, bytes memory returnData) = token.staticcall(abi.encodeWithSignature("DOMAIN_SEPARATOR()"));
        require(succeeded, "domain");
        return abi.decode(returnData, (bytes32));
    }
}
