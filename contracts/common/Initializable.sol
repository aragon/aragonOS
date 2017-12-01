pragma solidity ^0.4.18;


contract Initializable {
    uint256 public initializationBlock;

    modifier onlyInit {
        require(initializationBlock == 0);
        _;
    }

    /**
    * @dev Function to be called by top level contract after initialization has finished.
    */
    function initialized() internal onlyInit {
        initializationBlock = block.number;
    }
}
