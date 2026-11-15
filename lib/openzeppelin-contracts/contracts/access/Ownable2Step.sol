// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Ownable {
    address private _owner;
    address private _pendingOwner;

    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    modifier onlyOwner() {
        if (msg.sender != _owner) revert OwnableUnauthorizedAccount(msg.sender);
        _;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _pendingOwner = newOwner;
    }

    function acceptOwnership() public virtual {
        if (msg.sender != _pendingOwner) revert OwnableUnauthorizedAccount(msg.sender);
        address oldOwner = _owner;
        _owner = msg.sender;
        _pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, msg.sender);
    }
}

contract Ownable2Step is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}
}
