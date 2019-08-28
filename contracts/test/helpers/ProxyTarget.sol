pragma solidity 0.4.24;

contract ProxyTarget {
    event Pong();

    function ping() external {
      emit Pong();
    }
}

contract ProxyTargetWithFallback is ProxyTarget {
    event ReceivedEth();

    function () external payable {
      emit ReceivedEth();
    }
}