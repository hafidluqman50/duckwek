// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {DuckWekBase} from "./DuckWekBase.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PartNFT} from "../src/PartNFT.sol";

contract VaultHandler is Test {
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    uint16 constant NO_PART = type(uint16).max;

    DuckWekVault public vault;
    MockUSDC public usdc;
    address public operator;
    address[] public actors;
    uint256[] public keys;
    bytes32[] public rooms;
    uint256 public salt;
    uint256 public chargedOutsideSession;
    uint256 public successfulSpends;

    constructor(DuckWekVault vault_, MockUSDC usdc_, address operator_, uint256[] memory keys_) {
        vault = vault_;
        usdc = usdc_;
        operator = operator_;
        for (uint256 index; index < keys_.length; ++index) {
            keys.push(keys_[index]);
            actors.push(vm.addr(keys_[index]));
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _order(address payer, uint256 kindSeed, uint256 refSeed)
        internal
        returns (DuckWekVault.Order memory order)
    {
        uint8 kind = uint8(bound(kindSeed, 1, 3));
        uint256 referenceId;
        bytes32 roomKey;
        if (kind == 1) {
            referenceId = bound(refSeed, 1, 2);
            roomKey = keccak256(abi.encode("room", ++salt));
            rooms.push(roomKey);
        } else if (kind == 2) {
            referenceId = 0;
            roomKey = rooms.length == 0 ? keccak256("none") : rooms[refSeed % rooms.length];
        } else {
            referenceId = bound(refSeed, 0, 2);
        }

        DuckWekVault.Loadout memory loadout;
        loadout.partBySlot = [NO_PART, NO_PART, NO_PART];
        order = DuckWekVault.Order(payer, kind, referenceId, roomKey, loadout, vault.priceOf(kind, referenceId), ++salt);
    }

    function _record(address payer, bool succeeded) internal {
        if (!succeeded) return;

        ++successfulSpends;
        if (block.timestamp > vault.sessionEnd(payer)) ++chargedOutsideSession;
    }

    function permitSpend(uint256 actorSeed, uint256 kindSeed, uint256 refSeed, uint256 capSeed, uint256 lifetimeSeed)
        external
    {
        uint256 actorIndex = actorSeed % actors.length;
        address payer = actors[actorIndex];
        uint256 cap = bound(capSeed, 1_000_000, 5_000_000);
        uint256 deadline = block.timestamp + bound(lifetimeSeed, 1 hours, 3 days);
        DuckWekVault.Order memory order = _order(payer, kindSeed, refSeed);
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(vault), cap, usdc.nonces(payer), deadline));
        (uint8 recoveryId, bytes32 signatureR, bytes32 signatureS) =
            vm.sign(keys[actorIndex], keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
        vm.prank(operator);
        try vault.permitAndSpend(order, DuckWekVault.Permit(cap, deadline, recoveryId, signatureR, signatureS)) {
            _record(payer, true);
        } catch {}
    }

    function spend(uint256 actorSeed, uint256 kindSeed, uint256 refSeed) external {
        address payer = actors[actorSeed % actors.length];
        DuckWekVault.Order memory order = _order(payer, kindSeed, refSeed);
        vm.prank(operator);
        try vault.spend(order) {
            _record(payer, true);
        } catch {}
    }

    function warp(uint256 delay) external {
        vm.warp(block.timestamp + bound(delay, 1, 2 days));
    }

    function withdraw(uint256 accountSeed, uint256 amountSeed) external {
        address account = accountSeed % 3 == 0
            ? vault.treasury()
            : accountSeed % 3 == 1 ? address(0xC0FFEE0) : actors[accountSeed % actors.length];
        uint256 availableAmount = vault.available(account);
        if (availableAmount == 0) return;

        uint256 amount = bound(amountSeed, 1, availableAmount);
        vm.prank(account);
        try vault.withdraw(amount) {} catch {}
    }
}

contract VaultInvariantTest is StdInvariant, DuckWekBase {
    VaultHandler handler;
    address creatorHolder;

    function setUp() public override {
        super.setUp();
        uint256[] memory keys = new uint256[](5);
        for (uint256 index; index < 5; ++index) {
            keys[index] = 7000 + index;
            vm.prank(owner);
            usdc.mint(vm.addr(keys[index]), 100 * 1e6);
        }

        handler = new VaultHandler(vault, usdc, operator, keys);
        creatorHolder = creator;
        targetContract(address(handler));
    }

    function _sumOwed() internal view returns (uint256 sum) {
        sum = vault.available(treasury) + vault.available(creatorHolder);
        for (uint256 index; index < handler.actorCount(); ++index) {
            sum += vault.available(handler.actors(index));
        }
    }

    function invariant_vaultHoldsExactlyWhatItOwes() public view {
        assertEq(usdc.balanceOf(address(vault)), _sumOwed());
    }

    function invariant_sessionNeverSpendsPastItsCap() public view {
        for (uint256 index; index < handler.actorCount(); ++index) {
            address actor = handler.actors(index);
            assertLe(vault.sessionSpent(actor), vault.sessionCap(actor));
        }
    }

    function invariant_noChargeAfterTheSessionEnded() public view {
        assertEq(handler.chargedOutsideSession(), 0);
    }

    function invariant_oneLicencePerTypePerWallet() public view {
        uint256 typeCount = parts.typeCount();
        for (uint256 index; index < handler.actorCount(); ++index) {
            address actor = handler.actors(index);
            assertLe(parts.balanceOf(actor), typeCount);
            for (uint256 typeId; typeId < typeCount; ++typeId) {
                uint256 tokenId = parts.licenseOf(actor, typeId);
                if (tokenId != 0) assertEq(parts.ownerOf(tokenId), actor);
            }
        }
    }
}
