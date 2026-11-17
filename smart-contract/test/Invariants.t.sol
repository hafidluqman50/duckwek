// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {DuckWekBase} from "./DuckWekBase.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PartNFT} from "../src/PartNFT.sol";

/// Random sequences of paid orders, time jumps and withdrawals against the Vault. The handler is the only thing the fuzzer calls;
/// it never reverts the run, a refused order is a legal outcome. After every sequence the invariants below must still hold.
contract VaultHandler is Test {
    bytes32 constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    uint16 constant NO_PART = type(uint16).max;

    DuckWekVault public vault;
    MockUSDC public usdc;
    address public operator;
    address[] public actors;
    uint256[] public keys;
    bytes32[] public rooms;
    uint256 public salt;
    uint256 public chargedOutsideSession; // must stay 0
    uint256 public okSpends;

    constructor(DuckWekVault v, MockUSDC u, address op, uint256[] memory ks) {
        vault = v;
        usdc = u;
        operator = op;
        for (uint256 i; i < ks.length; ++i) {
            keys.push(ks[i]);
            actors.push(vm.addr(ks[i]));
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _order(address payer, uint256 kindSeed, uint256 refSeed) internal returns (DuckWekVault.Order memory o) {
        uint8 kind = uint8(bound(kindSeed, 1, 3));
        uint256 ref;
        bytes32 roomKey;
        if (kind == 1) {
            ref = bound(refSeed, 1, 2);
            roomKey = keccak256(abi.encode("room", ++salt));
            rooms.push(roomKey);
        } else if (kind == 2) {
            ref = 0;
            roomKey = rooms.length == 0 ? keccak256("none") : rooms[refSeed % rooms.length];
        } else {
            ref = bound(refSeed, 0, 2);
        }
        DuckWekVault.Loadout memory l;
        l.partBySlot = [NO_PART, NO_PART, NO_PART];
        o = DuckWekVault.Order(payer, kind, ref, roomKey, l, vault.priceOf(kind, ref), ++salt);
    }

    function _record(address payer, bool ok) internal {
        if (!ok) return;
        ++okSpends;
        // A charge that went through must fall inside the payer's session, at the moment it happened.
        if (block.timestamp > vault.sessionEnd(payer)) ++chargedOutsideSession;
    }

    /// First order of a session: a fresh permit with a random cap and lifetime.
    function permitSpend(uint256 actorSeed, uint256 kindSeed, uint256 refSeed, uint256 capSeed, uint256 ttlSeed) external {
        uint256 i = actorSeed % actors.length;
        address payer = actors[i];
        uint256 cap = bound(capSeed, 1_000_000, 5_000_000);
        uint256 deadline = block.timestamp + bound(ttlSeed, 1 hours, 3 days);
        DuckWekVault.Order memory o = _order(payer, kindSeed, refSeed);
        bytes32 sh = keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(vault), cap, usdc.nonces(payer), deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[i], keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), sh)));
        vm.prank(operator);
        try vault.permitAndSpend(o, DuckWekVault.Permit(cap, deadline, v, r, s)) {
            _record(payer, true);
        } catch {}
    }

    /// Later orders ride on the session of the permit (if it is still alive).
    function spend(uint256 actorSeed, uint256 kindSeed, uint256 refSeed) external {
        address payer = actors[actorSeed % actors.length];
        DuckWekVault.Order memory o = _order(payer, kindSeed, refSeed);
        vm.prank(operator);
        try vault.spend(o) {
            _record(payer, true);
        } catch {}
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 2 days));
    }

    function withdraw(uint256 who, uint256 amountSeed) external {
        address a = who % 3 == 0 ? vault.treasury() : who % 3 == 1 ? address(0xC0FFEE0) : actors[who % actors.length];
        uint256 avail = vault.available(a);
        if (avail == 0) return;
        uint256 amount = bound(amountSeed, 1, avail);
        vm.prank(a);
        try vault.withdraw(amount) {} catch {}
    }
}

contract VaultInvariantTest is StdInvariant, DuckWekBase {
    VaultHandler handler;
    address creatorHolder;

    function setUp() public override {
        super.setUp();
        uint256[] memory ks = new uint256[](5);
        for (uint256 i; i < 5; ++i) {
            ks[i] = 7000 + i;
            vm.prank(owner);
            usdc.mint(vm.addr(ks[i]), 100 * 1e6);
        }
        handler = new VaultHandler(vault, usdc, operator, ks);
        // a creator circuit, so the split between a holder and the protocol is exercised as well
        creatorHolder = creator;
        targetContract(address(handler));
    }

    function _sumOwed() internal view returns (uint256 sum) {
        sum = vault.available(treasury) + vault.available(creatorHolder);
        for (uint256 i; i < handler.actorCount(); ++i) sum += vault.available(handler.actors(i));
    }

    /// The Vault holds exactly what it owes: every credit is backed by USDC, every withdrawal is deducted.
    function invariant_vaultHoldsExactlyWhatItOwes() public view {
        assertEq(usdc.balanceOf(address(vault)), _sumOwed());
    }

    /// A session can never spend more than its cap.
    function invariant_sessionNeverSpendsPastItsCap() public view {
        for (uint256 i; i < handler.actorCount(); ++i) {
            address a = handler.actors(i);
            assertLe(vault.sessionSpent(a), vault.sessionCap(a));
        }
    }

    /// No charge ever goes through after the session of that payer has ended.
    function invariant_noChargeAfterTheSessionEnded() public view {
        assertEq(handler.chargedOutsideSession(), 0);
    }

    /// A wallet never holds two licences of the same part type.
    function invariant_oneLicencePerTypePerWallet() public view {
        uint256 types = parts.typeCount();
        for (uint256 i; i < handler.actorCount(); ++i) {
            address a = handler.actors(i);
            assertLe(parts.balanceOf(a), types);
            for (uint256 t; t < types; ++t) {
                uint256 id = parts.licenseOf(a, t);
                if (id != 0) assertEq(parts.ownerOf(id), a);
            }
        }
    }
}
