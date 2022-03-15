// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IFactory.sol";
import "./interfaces/IRegistry.sol";

/**
 * @title Luckbox v.2
 * @dev A contract aims to help distribute NFTs for collectors to users who met the conditions
 */

contract LuckBox is
    Ownable,
    ReentrancyGuard,
    IERC721Receiver,
    ERC165,
    ERC721Holder,
    ERC1155Holder
{
    using SafeMath for uint256;
    using Address for address;

    // POAP info
    struct Poap {
        address assetAddress;
        uint256 tokenId;
        bool is1155;
    }

    // Event Info
    struct Event {
        string name;
        uint256[] poaps;
        bytes32 merkleRoot; // to claim
        mapping(address => bool) claimed;
        uint256 claimCount;
        bool ended;
        bool active;
    }

    // Project Info
    struct Project {
        string name;
        bytes32 merkleRoot;
        uint256 timestamp;
        bool active;
    }

    // Poap Id => Poap
    mapping(uint256 => Poap) public poaps;
    // Event Id => Event
    mapping(uint256 => Event) public events;
    // Project Id => Project
    mapping(uint256 => Project) public projects;

    uint256 private nonce;

    IRegistry public registry;

    bytes32 private constant FACTORY =
        0x464143544f525900000000000000000000000000000000000000000000000000;

    event EventCreated(uint256 indexed eventId, string name, uint256[] poaps);

    event PoapCreated(
        uint256 indexed poapId,
        address assetAddress,
        uint256 tokenId,
        bool is1155
    );

    event Deposited(
        address from,
        address assetAddress,
        uint256 tokenId,
        uint256 amount,
        bool is1155
    );

    event Claimed(
        address to,
        uint256 eventId,
        address assetAddress,
        uint256 tokenId,
        bool is1155
    );

    event ProjectCreated(uint256 indexed projectId, string name);

    constructor(address _registry) public {
        _registerInterface(IERC721Receiver.onERC721Received.selector);
    }

    function eligible(
        uint256 _projectId,
        address _address,
        bytes32[] memory _proof
    ) public view returns (bool) {
        return _eligible(_projectId, _address, _proof);
    }
    
    function checkClaim(uint256 _eventId, uint256 _poapId, bytes32[] memory _proof) public view returns (bool) {
        return _checkClaim(_eventId, _poapId, _proof);
    }

    function claim(
        uint256 _eventId,
        uint256 _poapId,
        bytes32[] memory _proof
    ) public nonReentrant {
        require(events[_eventId].active == true, "Given Event ID is invalid");
        require(events[_eventId].ended == false, "The event is ended");
        require(events[_eventId].claimed[msg.sender] == false, "The caller is already claimed");
        require(_checkClaim(_eventId, _poapId, _proof) == true, "The caller is not eligible to claim the given poap");

        if(poaps[_poapId].is1155) {
            IERC1155(poaps[_poapId].assetAddress).safeTransferFrom(
                address(this),
                msg.sender,
                poaps[_poapId].tokenId,
                1,
                "0x00"
            );
        } else {
            IERC721(poaps[_poapId].assetAddress).safeTransferFrom(
                address(this),
                msg.sender,
                poaps[_poapId].tokenId
            );
        }

        events[_eventId].claimed[msg.sender] = true;
        events[_eventId].claimCount += 1;

        emit Claimed(msg.sender, _eventId, poaps[_poapId].assetAddress, poaps[_poapId].tokenId, poaps[_poapId].is1155);
    }

    function depositERC1155(
        address _assetAddress,
        uint256 _tokenId,
        uint256 _amount
    ) public nonReentrant {
        IERC1155(_assetAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _tokenId,
            _amount,
            "0x00"
        );

        emit Deposited(msg.sender, _assetAddress, _tokenId, _amount, true);
    }

    function depositERC721(address _assetAddress, uint256 _tokenId)
        public
        nonReentrant
    {
        IERC721(_assetAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _tokenId
        );

        emit Deposited(msg.sender, _assetAddress, _tokenId, 1, false);
    }

    function createPoap(
        uint256 _poapId,
        address _assetAddress,
        uint256 _tokenId,
        bool _is1155
    ) public nonReentrant onlyOwner {
        require(
            poaps[_poapId].assetAddress == address(0),
            "Given ID is occupied"
        );

        poaps[_poapId].assetAddress = _assetAddress;
        poaps[_poapId].tokenId = _tokenId;
        poaps[_poapId].is1155 = _is1155;

        emit PoapCreated(_poapId, _assetAddress, _tokenId, _is1155);
    }

    function createEvent(
        uint256 _eventId,
        string memory _name,
        uint256[] memory _poaps
    ) public nonReentrant onlyOwner {
        require(events[_eventId].active == false, "Given ID is occupied");

        events[_eventId].active = true;
        events[_eventId].name = _name;
        events[_eventId].poaps = _poaps;

        emit EventCreated(_eventId, _name, _poaps);
    }

    function createProject(uint256 _projectId, string memory _name)
        public
        nonReentrant
        onlyOwner
    {
        require(projects[_projectId].active == false, "Given ID is occupied");

        projects[_projectId].active = true;
        projects[_projectId].name = _name;

        emit ProjectCreated(_projectId, _name);
    }

    function attachClaim(uint256 _eventId, bytes32 _merkleRoot)
        public
        nonReentrant
        onlyOwner
    {
        require(events[_eventId].active == true, "Given ID is invalid");

        events[_eventId].merkleRoot = _merkleRoot;
    }

    function attachWhitelist(uint256 _projectId, bytes32 _merkleRoot)
        public
        nonReentrant
        onlyOwner
    {
        require(projects[_projectId].active == true, "Given ID is invalid");

        projects[_projectId].merkleRoot = _merkleRoot;
        projects[_projectId].timestamp = now;
    }

    function attachWhitelistBatch(uint256[] memory _projectIds, bytes32[] memory _merkleRoots)
        public
        nonReentrant
        onlyOwner
    {
        require( _projectIds.length == _merkleRoots.length , "Array size is not the same length" );

        for (uint256 i = 0; i < _projectIds.length; i++) {
            projects[_projectIds[i]].merkleRoot = _merkleRoots[i];
            projects[_projectIds[i]].timestamp = now;
        }

    }

    function updatePoaps(uint256 _eventId, uint256[] memory _poaps)
        public
        nonReentrant
        onlyOwner
    {
        require(events[_eventId].active == true, "Given ID is invalid");

        events[_eventId].poaps = _poaps;
    }

    function emergencyWithdrawERC1155(
        address _to,
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _amount
    ) public nonReentrant onlyOwner {
        IERC1155(_tokenAddress).safeTransferFrom(
            address(this),
            _to,
            _tokenId,
            _amount,
            "0x00"
        );
    }

    function increaseNonce() public nonReentrant onlyOwner {
        nonce += 1;
    }

    function emergencyWithdrawERC721(
        address _to,
        address _tokenAddress,
        uint256 _tokenId
    ) public nonReentrant onlyOwner {
        IERC721(_tokenAddress).safeTransferFrom(address(this), _to, _tokenId);
    }

    // PRIVATE FUNCTIONS

    function _checkClaim(uint256 _eventId, uint256 _poapId, bytes32[] memory _proof) internal view returns (bool) {
        uint256 test = 1;
        bytes32 leaf = keccak256(abi.encodePacked( msg.sender , _poapId));
        return MerkleProof.verify(_proof, events[_eventId].merkleRoot, leaf);
    }

    function _generateRandomNumber() internal view returns (uint256) {
        uint256 randomNonce = nonce;

        if (registry.getContractAddress(FACTORY) != address(0)) {
            IFactory factory = IFactory(registry.getContractAddress(FACTORY));
            randomNonce = factory.randomNonce();
        }

        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(now, msg.sender, randomNonce, address(this))
            )
        );

        return randomNumber;
    }

    function _eligible(
        uint256 _projectId,
        address _address,
        bytes32[] memory _proof
    ) internal view returns (bool) {
        require(projects[_projectId].active == true, "Given ID is invalid");

        bytes32 leaf = keccak256(abi.encodePacked(_address));

        return
            MerkleProof.verify(_proof, projects[_projectId].merkleRoot, leaf);
    }

     

}
