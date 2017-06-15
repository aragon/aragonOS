pragma solidity ^0.4.11;

import "../Application.sol";
import "./BylawsLib.sol";
import "../../kernel/Kernel.sol";

contract BylawsApp is Application, PermissionsOracle {
  using BylawsLib for BylawsLib.Bylaws;
  using BylawsLib for BylawsLib.Bylaw;

  event BylawChanged(string functionSignature, uint8 bylawType);

  BylawsLib.Bylaws bylaws;

  function BylawsApp(address _dao)
           Application(_dao) {}

  // Conformance to permission oracle interface
  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool) {
    return canPerformAction(getSig(data), sender, data);
  }

  function performedAction(address sender, address token, uint256 value, bytes data) {}

  function canPerformAction(bytes4 sig, address sender, bytes data) constant public returns (bool) {
    return canPerformAction(bylaws.bylaws[sig], sig, sender, data);
  }

  function canPerformAction(BylawsLib.Bylaw storage bylaw, bytes4 sig, address sender, bytes data) internal returns (bool) {
    return bylaw.canPerformAction(sig, sender, data, msg.value);
  }

  // Sensitive setters
  function setStatusBylaw(string functionSignature, uint8 statusNeeded, bool isSpecialStatus)
           onlyDAO {
    bylaws.setStatusBylaw(functionSignature, statusNeeded, isSpecialStatus);
  }

  function setAddressBylaw(string functionSignature, address addr, bool isOracle)
           onlyDAO {
    bylaws.setAddressBylaw(functionSignature, addr, isOracle);
  }

  function setVotingBylaw(string functionSignature, uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime, uint8 option)
           onlyDAO {
    bylaws.setVotingBylaw(functionSignature, support, base, closingRelativeMajority, minimumVotingTime, option);
  }

  // Read functions
  function getBylawType(string functionSignature) constant returns (uint8 bylawType, uint64 updated, address updatedBy) {
    return bylaws.getBylawType(functionSignature);
  }

  function getStatusBylaw(string functionSignature) constant returns (uint8) {
    BylawsLib.Bylaw memory b = bylaws.getBylaw(functionSignature);

    if (b.status.enforced) return b.status.neededStatus;

    return uint8(255);
  }

  function getVotingBylaw(string functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime) {
    return getVotingBylaw(bytes4(sha3(functionSignature)));
  }

  function getVotingBylaw(bytes4 functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime) {
    BylawsLib.VotingBylaw memory b = bylaws.getBylaw(functionSignature).voting;

    if (!b.enforced) return;

    support = b.supportNeeded;
    base = b.supportBase;
    closingRelativeMajority = b.closingRelativeMajority;
    minimumVotingTime = b.minimumVotingTime;
  }


  function getAddressBylaw(string functionSignature) constant returns (address) {
    BylawsLib.AddressBylaw memory b = bylaws.getBylaw(functionSignature).addr;

    if (!b.enforced) return;

    return b.addr;
  }

  function canHandlePayload(bytes payload) constant returns (bool) {
    bytes4 sig = getSig(payload);
    return
      sig == 0xde64e15c || // setStatusBylaw(string,uint8,bool)
      sig == 0x010555b8 || // setAddressBylaw(...)
      sig == 0x69207f04;   // setVotingBylaw(...)
  }
}
