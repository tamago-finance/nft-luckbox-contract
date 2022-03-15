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

    // POAP info (support only ERC-1155)
    struct Poap {
        address assetAddress;
        uint256 tokenId;
        bool is1155;
    }

    // Event Info
    struct Event {
        string name;
        uint256[] poaps;
        bytes32 merkleRootWL; // to verify that the user is eligible to claim
        bytes32 merkleRootClaim; // to claim
        mapping(address => bool) claimed;
        uint256 claimCount;
        bool ended;
        bool active;
    }

    mapping(uint256 => Poap) public poaps;
    mapping(uint256 => Event) public events;
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

    constructor(address _registry) public {
        registry = IRegistry(_registry);

        _registerInterface(IERC721Receiver.onERC721Received.selector);
    }

    function eligible(
        uint256 _eventId,
        address _address,
        bytes32[] memory _proof
    ) public view returns (bool) {
        return _eligible(_eventId, _address, _proof);
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
            poaps[_poapId].assetAddress != address(0),
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

    function attachMerkleRootToEvent(
        uint256 _eventId,
        bytes32 _merkleRoot,
        bool _isWL
    ) public nonReentrant onlyOwner {
        require(events[_eventId].active == true, "Given ID is invalid");

        if (_isWL) {
            events[_eventId].merkleRootWL = _merkleRoot;
        } else {
            events[_eventId].merkleRootClaim = _merkleRoot;
        }
    }

    function updatePoapToEvent(uint256 _eventId, uint256[] memory _poaps)
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
        uint256 _eventId,
        address _address,
        bytes32[] memory _proof
    ) internal view returns (bool) {
        require(events[_eventId].active == true, "Given ID is invalid");

        bytes32 leaf = keccak256(abi.encodePacked(_address));

        return MerkleProof.verify(_proof, events[_eventId].merkleRootWL, leaf);
    }

    // TODO : CLAIM
}
