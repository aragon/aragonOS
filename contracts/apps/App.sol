pragma solidity 0.4.15;

import "./AppStorage.sol";

contract App is AppStorage {
    modifier auth {
        require(canPerform(msg.sender, msg.sig));
        _;
    }

    modifier authSig(bytes4 sig) {
        require(canPerform(msg.sender, sig));
        _;
    }

    function canPerform(address _sender, bytes4 _sig) returns (bool) {
        return address(kernel) == 0 || kernel.canPerform(_sender, address(this), _sig);
    }
}
