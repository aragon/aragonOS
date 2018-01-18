pragma solidity 0.4.18;


interface IEVMScriptExecutor {
    function execScript(bytes script, bytes input, address[] blacklist) external returns (bytes);

    // Maybe add the decoder functionality here too?
    function getScriptActionsCount(bytes _script) public pure returns (uint256);
    function getScriptAction(bytes _script, uint256 position) public pure returns (address, bytes);
}
