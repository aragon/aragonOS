pragma solidity 0.4.18;

contract EncodeMockInterface {
    function gogo(bytes a, bytes b, address[] c);
}

contract EncodeMock {
    bytes public result;

    function exec(bytes a, bytes b, address[] c) {
        EncodeMockInterface(this).gogo(a, b, c);
    }

    function () {
        result = msg.data;
    }
}
