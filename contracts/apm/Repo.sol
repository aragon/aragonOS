pragma solidity 0.4.18;

import "../apps/AragonApp.sol";


contract Repo is AragonApp {
    struct Version {
        uint16[3] semanticVersion;
        address contractAddress;
        bytes contentURI;
    }

    Version[] versions;
    mapping (bytes32 => uint256) versionIdForSemantic;
    mapping (address => uint256) latestVersionIdForContract;

    // bytes32 constant public CREATE_VERSION_ROLE = keccak256("CREATE_VERSION_ROLE");
    bytes32 constant public CREATE_VERSION_ROLE = 0x1f56cfecd3595a2e6cc1a7e6cb0b20df84cdbd92eff2fee554e70e4e45a9a7d8;

    event NewVersion(uint256 versionId, uint16[3] semanticVersion);

    /**
    * @notice Create new version for repo
    * @param _newSemanticVersion Semantic version for new repo version
    * @param _contractAddress address for smart contract logic for version (if set to 0, it uses last versions' contractAddress)
    * @param _contentURI External URI for fetching new version's content
    */
    function newVersion(
        uint16[3] _newSemanticVersion,
        address _contractAddress,
        bytes _contentURI
    ) auth(CREATE_VERSION_ROLE) public
    {
        address contractAddress = _contractAddress;
        if (versions.length > 0) {
            Version storage lastVersion = versions[versions.length - 1];
            require(isValidBump(lastVersion.semanticVersion, _newSemanticVersion));
            if (contractAddress == 0) {
                contractAddress = lastVersion.contractAddress;
            }
            // Only allows smart contract change on major version bumps
            require(lastVersion.contractAddress == contractAddress || _newSemanticVersion[0] > lastVersion.semanticVersion[0]);
        } else {
            versions.length += 1;
            uint16[3] memory zeroVersion;
            require(isValidBump(zeroVersion, _newSemanticVersion));
        }

        uint versionId = versions.push(Version(_newSemanticVersion, contractAddress, _contentURI)) - 1;
        versionIdForSemantic[semanticVersionHash(_newSemanticVersion)] = versionId;
        latestVersionIdForContract[contractAddress] = versionId;

        NewVersion(versionId, _newSemanticVersion);
    }

    function getLatest() public view returns (uint16[3] semanticVersion, address contractAddress, bytes contentURI) {
        return getByVersionId(versions.length - 1);
    }

    function getLatestForContractAddress(address _contractAddress) public view returns (uint16[3] semanticVersion, address contractAddress, bytes contentURI) {
        return getByVersionId(latestVersionIdForContract[_contractAddress]);
    }

    function getBySemanticVersion(uint16[3] _semanticVersion) public view returns (uint16[3] semanticVersion, address contractAddress, bytes contentURI) {
        return getByVersionId(versionIdForSemantic[semanticVersionHash(_semanticVersion)]);
    }

    function getByVersionId(uint _versionId) public view returns (uint16[3] semanticVersion, address contractAddress, bytes contentURI) {
        require(_versionId > 0);
        Version storage version = versions[_versionId];
        return (version.semanticVersion, version.contractAddress, version.contentURI);
    }

    function getVersionsCount() public view returns (uint256) {
        uint256 len = versions.length;
        return len > 0 ? len - 1 : 0;
    }

    function isValidBump(uint16[3] _oldVersion, uint16[3] _newVersion) public pure returns (bool) {
        bool hasBumped;
        uint i = 0;
        while (i < 3) {
            if (hasBumped) {
                if (_newVersion[i] != 0) {
                    return false;
                }
            } else if (_newVersion[i] != _oldVersion[i]) {
                if (_oldVersion[i] > _newVersion[i] || _newVersion[i] - _oldVersion[i] != 1) {
                    return false;
                }
                hasBumped = true;
            }
            i++;
        }
        return hasBumped;
    }

    function semanticVersionHash(uint16[3] version) internal pure returns (bytes32) {
        return keccak256(version[0], version[1], version[2]);
    }
}
