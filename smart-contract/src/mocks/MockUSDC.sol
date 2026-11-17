// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// slither-disable-start missing-inheritance
contract MockUSDC is ERC20, ERC20Permit, Ownable {
    uint256 public constant WELCOME_AMOUNT = 5_000_000;

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
        require(vault_ != address(0), "zero vault");
        vault = vault_;
        emit VaultSet(vault_);
    }

    function welcomeMint(address to) external returns (bool minted) {
        if (msg.sender != vault) revert NotVault();

        if (welcomed[to]) return false;

        welcomed[to] = true;
        _mint(to, WELCOME_AMOUNT);
        emit Welcome(to, WELCOME_AMOUNT);
        return true;
    }
}
// slither-disable-end missing-inheritance
