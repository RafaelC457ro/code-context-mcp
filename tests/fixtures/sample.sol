// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './IERC20.sol';

interface IToken {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Token is IToken {
    struct Balance {
        uint256 amount;
        uint256 lastUpdated;
    }

    enum Status { Active, Paused, Stopped }

    event Transfer(address indexed from, address indexed to, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner());
        _;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        emit Transfer(from, to, amount);
    }

    function owner() public view returns (address) {
        return address(0);
    }
}
