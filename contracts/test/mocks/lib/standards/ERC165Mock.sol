pragma solidity 0.4.24;

import "../../../../lib/standards/ERC165.sol";


contract ERC165Mock is ERC165 {
    bytes4 public constant ERC165_INTERFACE = ERC165_INTERFACE_ID;

    function interfaceID() external pure returns (bytes4) {
        ERC165 erc165;
        return erc165.supportsInterface.selector;
    }
}
