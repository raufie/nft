// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract AccessControl {
    address internal developerAddress;
    address internal artistAddress;

    // modifiers
    // onlyCEO
    // onlyCFO
    // setCEO
    // setCFO

    constructor(address _artistAddress) {
        developerAddress = msg.sender;
        artistAddress = _artistAddress;
    }
}
