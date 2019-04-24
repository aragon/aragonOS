pragma solidity 0.4.24;

import "../base/KillSwitch.sol";
import "../../kernel/Kernel.sol";


contract KernelKillSwitch is Kernel, KillSwitch {
    string private constant ERROR_CONTRACT_CALL_NOT_ALLOWED = "KERNEL_CONTRACT_CALL_NOT_ALLOWED";

    function initialize(IssuesRegistry _issuesRegistry, IACL _baseAcl, address _permissionsCreator) public onlyInit {
        _setIssuesRegistry(_issuesRegistry);
        Kernel.initialize(_baseAcl, _permissionsCreator);
    }

    function getApp(bytes32 _namespace, bytes32 _appId) public view returns (address) {
        // TODO: The tx information that the kill switch should eval cannot be accessed from here.
        // Note that `msg.sender` is the proxy requesting the base app address, and `msg.data`
        // refers to this call (`Kernel#getApp(bytes32,bytes32)`)

        address _app = super.getApp(_namespace, _appId);
        bool _isCallAllowed = !shouldDenyCallingContract(_app, msg.sender, address(0), new bytes(0), uint256(0));
        require(_isCallAllowed, ERROR_CONTRACT_CALL_NOT_ALLOWED);
        return _app;
    }

    function _shouldEvaluateCall(address _base, address _instance, address _sender, bytes _data, uint256 _value) internal returns (bool) {
        /****************************************** IMPORTANT *********************************************/
        /*  Due to how proxies work, every time we call a proxied app, we will ask the kernel what's the  */
        /*  address of the base implementation where it should delegate the call to. But since the kernel */
        /*  is also a proxy, it will basically delegate that query to the base kernel implementation, and */
        /*  that's when this context is evaluated. Thus, we don't have full context of the call that its  */
        /*  about to be delegated to the base app implementation, the msg.data corresponds to the Kernel  */
        /*  getApp(bytes32,bytes32) method for example. Therefore, handling specific scenarios here it's  */
        /*  really cumbersome. We could rely easily on timestamps or block information, but tx data does  */
        /*  not correspond to the application call in this context.                                       */
        /**************************************************************************************************/

        return super._shouldEvaluateCall(_base, _instance ,_sender, _data, _value);
    }
}
