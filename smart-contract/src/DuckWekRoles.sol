// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice FINANCE.md §7 key split:
///  - owner (multisig): configure, set treasury, pause. Not used day to day.
///  - operator (relayer): only the functions marked onlyOperator. Cannot withdraw anyone's funds.
abstract contract DuckWekRoles is Ownable2Step, Pausable {
    mapping(address => bool) public isOperator;

    event OperatorSet(address indexed operator, bool allowed);

    error NotOperator();

    constructor(address owner_) Ownable(owner_) {}

    modifier onlyOperator() {
        if (!isOperator[msg.sender]) revert NotOperator();
        _;
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        isOperator[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
