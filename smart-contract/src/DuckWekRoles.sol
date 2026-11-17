// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

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
