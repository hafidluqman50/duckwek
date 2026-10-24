// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock USDC for Monad testnet. 6 decimals, like real USDC. It is an EIP-2612 token (`permit`), exactly like
///         Circle's USDC, so the ONE signature a player gives at connect is a permit for the Vault and mainnet is only
///         an address change. The one mock-only addition is the welcome mint: the Vault mints `WELCOME_AMOUNT` once per
///         wallet inside that wallet's first paid order, so a new player never needs a faucet or an extra transaction.
contract MockUSDC is ERC20, ERC20Permit, Ownable {
    uint256 public constant WELCOME_AMOUNT = 5_000_000; // 5 USDC

    address public vault;
    mapping(address => bool) public welcomed;

    event VaultSet(address vault);
    event Welcome(address indexed to, uint256 amount);

    error NotVault();

    constructor(address owner_) ERC20("Mock USDC", "USDC") ERC20Permit("Mock USDC") Ownable(owner_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function setVault(address vault_) external onlyOwner {
        vault = vault_;
        emit VaultSet(vault_);
    }

    /// @notice Called by the Vault inside a wallet's first paid order. Mints once per wallet.
    function welcomeMint(address to) external returns (bool minted) {
        if (msg.sender != vault) revert NotVault();
        if (welcomed[to]) return false;
        welcomed[to] = true;
        _mint(to, WELCOME_AMOUNT);
        emit Welcome(to, WELCOME_AMOUNT);
        return true;
    }
}
