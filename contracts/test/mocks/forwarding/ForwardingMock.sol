pragma solidity 0.4.24;

import "../../../forwarding/IAbstractForwarder.sol";
import "../../../forwarding/IForwarderFee.sol";
import "../../../forwarding/IForwarder.sol";
import "../../../forwarding/IForwarderPayable.sol";
import "../../../forwarding/IForwarderWithContext.sol";
import "../../../forwarding/IForwarderWithContextPayable.sol";


contract BaseForwarderMock is IAbstractForwarder {
    function canForward(address, bytes) external view returns (bool) {
        return true;
    }
}


contract BaseForwarderPayableMock is BaseForwarderMock, IForwarderFee {
    function forwardFee() external view returns (address, uint256) {
        return (address(0), 0);
    }
}


contract ForwarderMock is BaseForwarderMock, IForwarder {
    function forward(bytes) external { }
}


contract ForwarderPayableMock is BaseForwarderPayableMock, IForwarderPayable {
    function forward(bytes) external payable { }
}


contract ForwarderWithContextMock is BaseForwarderMock, IForwarderWithContext {
    function forward(bytes, bytes) external { }
}


contract ForwarderWithContextPayableMock is BaseForwarderPayableMock, IForwarderWithContextPayable {
    function forward(bytes, bytes) external payable { }
}
