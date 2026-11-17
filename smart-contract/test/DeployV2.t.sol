// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DeployV2Script} from "../script/DeployV2.s.sol";
import {CheckDeployScript} from "../script/CheckDeploy.s.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {PartNFT} from "../src/PartNFT.sol";

/// The deploy script and the post-deploy check must agree: whatever DeployV2 builds, CheckDeploy accepts; and the check
/// rejects a deployment that was changed afterwards.
contract DeployV2Test is Test {
    address deployer;
    address operator = address(0x0E);
    address treasury = address(0x7E);

    function _deploy(address finalOwner) internal returns (DeployV2Script.Deployed memory d) {
        uint256 key = 0xDE91;
        deployer = vm.addr(key);
        vm.setEnv("PRIVATE_KEY", vm.toString(bytes32(key)));
        vm.setEnv("OPERATOR", vm.toString(operator));
        vm.setEnv("TREASURY", vm.toString(treasury));
        vm.setEnv("FINAL_OWNER", vm.toString(finalOwner));
        d = new DeployV2Script().run();
        vm.setEnv("VAULT", vm.toString(address(d.vault)));
        vm.setEnv("RACE", vm.toString(address(d.race)));
        vm.setEnv("PART_NFT", vm.toString(address(d.parts)));
        vm.setEnv("TRACK_NFT", vm.toString(address(d.tracks)));
        vm.setEnv("BADGE", vm.toString(address(d.badge)));
        vm.setEnv("USDC", vm.toString(d.usdc));
        vm.setEnv("EXPECTED_OWNER", vm.toString(finalOwner == address(0) ? deployer : finalOwner));
    }

    /// One test, run in order: `vm.setEnv` is process-wide and Foundry runs tests in parallel, so separate tests would race.
    function test_deploy_and_check_scenarios() public {
        // 1. whatever DeployV2 builds, CheckDeploy accepts
        DeployV2Script.Deployed memory d = _deploy(address(0));
        new CheckDeployScript().run();

        // 2. the check rejects a deployment changed afterwards
        vm.prank(deployer);
        d.vault.setOperator(operator, false);
        CheckDeployScript c = new CheckDeployScript();
        vm.expectRevert(bytes("vault operator"));
        c.run();

        // 3. a pending Ownable2Step transfer is not ownership yet
        address safe = address(0x5AFE);
        d = _deploy(safe);
        c = new CheckDeployScript();
        vm.expectRevert(bytes("vault owner"));
        c.run();

        // 4. after the Safe accepts, the check passes
        vm.startPrank(safe);
        d.vault.acceptOwnership();
        d.race.acceptOwnership();
        d.parts.acceptOwnership();
        d.tracks.acceptOwnership();
        d.badge.acceptOwnership();
        vm.stopPrank();
        new CheckDeployScript().run();
    }

    function test_a_fresh_deploy_serves_a_full_order_flow() public {
        DeployV2Script.Deployed memory d = _deploy(address(0));
        // the welcome mint lets a brand-new wallet pay without holding USDC: one permit, one order, one licence
        uint256 k = 0xBEEF;
        address p = vm.addr(k);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 structHash = keccak256(abi.encode(keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"), p, address(d.vault), uint256(5_000_000), uint256(0), deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(k, keccak256(abi.encodePacked("\x19\x01", _domain(d.usdc), structHash)));
        DuckWekVault.Order memory o = DuckWekVault.Order(p, 3, 0, bytes32(0), DuckWekVault.Loadout(0, [type(uint16).max, type(uint16).max, type(uint16).max]), 1_000_000, 1);
        vm.prank(operator);
        uint256 tokenId = d.vault.permitAndSpend(o, DuckWekVault.Permit(5_000_000, deadline, v, r, s));
        assertEq(d.parts.ownerOf(tokenId), p);
        assertGt(bytes(d.parts.tokenURI(tokenId)).length, 1000);
    }

    function _domain(address token) internal view returns (bytes32) {
        (bool ok, bytes memory out) = token.staticcall(abi.encodeWithSignature("DOMAIN_SEPARATOR()"));
        require(ok, "domain");
        return abi.decode(out, (bytes32));
    }
}
