pragma solidity 0.4.24;

import "../../../common/ReentrancyGuard.sol";
import "../../../common/UnstructuredStorage.sol";


contract ReentrantActor {
    bool reenterNonReentrant;

    constructor(bool _reenterNonReentrant) public {
        reenterNonReentrant = _reenterNonReentrant;
    }

    function reenter(ReentrancyGuardMock _mock) public {
        // Set the reentrancy target to 0 so we don't infinite loop
        ReentrantActor reentrancyTarget = ReentrantActor(0);

        if (reenterNonReentrant) {
            _mock.nonReentrantCall(reentrancyTarget);
        } else {
            _mock.reentrantCall(reentrancyTarget);
        }
    }
}


contract ReentrancyGuardMock is ReentrancyGuard {
    using UnstructuredStorage for bytes32;

    uint256 public callCounter;

    function nonReentrantCall(ReentrantActor _target) public nonReentrant {
        callCounter++;
        if (_target != address(0)) {
            _target.reenter(this);
        }
    }

    function reentrantCall(ReentrantActor _target) public {
        callCounter++;
        if (_target != address(0)) {
            _target.reenter(this);
        }
    }

    function setReentrancyMutex(bool _mutex) public {
        getReentrancyMutexPosition().setStorageBool(_mutex);
    }

    function getReentrancyMutexPosition() public pure returns (bytes32) {
        return keccak256("aragonOS.reentrancyGuard.mutex");
    }
}
