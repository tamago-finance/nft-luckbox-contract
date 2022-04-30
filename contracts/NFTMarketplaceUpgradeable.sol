// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./utility/WhitelistUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

/**
 * @title P2P marketplace
 */

contract NFTMarketplaceUpgradeable is
    Initializable,
    WhitelistUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC721ReceiverUpgradeable,
    ERC165Upgradeable,
    ERC721HolderUpgradeable,
    ERC1155HolderUpgradeable,
    PausableUpgradeable
{
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address;

    struct Order {
        address assetAddress;
        uint256 tokenId;
        bool is1155;
        address owner;
        bytes32 root;
        bool canceled;
        bool ended;
        bool active;
        bool crosschainAllowed; // when set equals true, the order can be fulfilled by the gateway
    }

    // Order Id => Order
    mapping(uint256 => Order) public orders;
    // Max. orders can be executed on swapBatch()
    uint256 maxBatchOrders;

    event OrderCreated(
        uint256 indexed orderId,
        address assetAddress,
        uint256 tokenId,
        bool is1155,
        address owner,
        bytes32 root
    );

    event OrderCreatedBatch(
        uint256[] indexed orderIds,
        address[] assetAddresses,
        uint256[] tokenIds,
        bool[] is1155s,
        address owner,
        bytes32[] roots
    );

    event OrderCanceled(uint256 indexed orderId, address owner);

    event Swapped(
        uint256 indexed orderId,
        address fromAddress
    );

    event SwappedBatch(
        uint256[] indexed orderId,
        address fromAddress
    );

    function initialize(address _devAddress) public initializer {
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        ERC721HolderUpgradeable.__ERC721Holder_init();
        ERC165Upgradeable.__ERC165_init();
        ERC1155HolderUpgradeable.__ERC1155Holder_init();
        PausableUpgradeable.__Pausable_init();
        WhitelistUpgradeable.__Whitelist_init();

        // add dev into the whitelist
        addAddress(_devAddress);

        maxBatchOrders = 10;

        if (_devAddress != msg.sender) {
            addAddress(msg.sender);
        }

        _registerInterface(
            IERC721ReceiverUpgradeable.onERC721Received.selector
        );
    }

    /// @notice create an order and deposit NFT to the contract
    /// @param _orderId ID for the order
    /// @param _assetAddress NFT contract address being listed
    /// @param _tokenId NFT token ID being listed
    /// @param _is1155 NFT's being listed ERC1155 flag
    /// @param _root in the barter list in merkle tree root
    function createOrder(
        uint256 _orderId,
        address _assetAddress,
        uint256 _tokenId,
        bool _is1155,
        bytes32 _root
    ) public nonReentrant whenNotPaused {
        _createOrder(_orderId, _assetAddress, _tokenId, _is1155, _root);

        emit OrderCreated(
            _orderId,
            _assetAddress,
            _tokenId,
            _is1155,
            msg.sender,
            _root
        );
    }

    /// @notice create an order and deposit NFT to the contract
    /// @param _orderIds ID for the order
    /// @param _assetAddresses NFT contract address being listed
    /// @param _tokenIds NFT token ID being listed
    /// @param _is1155s NFT's being listed ERC1155 flag
    /// @param _roots in the barter list in merkle tree root
    function createBatchOrders(
        uint256[] calldata _orderIds,
        address[] calldata _assetAddresses,
        uint256[] calldata _tokenIds,
        bool[] calldata _is1155s,
        bytes32[] calldata _roots
    ) external whenNotPaused nonReentrant {
        require(maxBatchOrders >= _orderIds.length, "Exceed batch size");

        for (uint256 i = 0; i < _orderIds.length; i++) {
            _createOrder(
                _orderIds[i],
                _assetAddresses[i],
                _tokenIds[i],
                _is1155s[i],
                _roots[i]
            );
        }

        emit OrderCreatedBatch(
            _orderIds,
            _assetAddresses,
            _tokenIds,
            _is1155s,
            msg.sender,
            _roots
        );
    }

    /// @notice cancel the order and return NFT back to the original holder
    /// @param _orderId ID that want to cancel
    function cancelOrder(uint256 _orderId) public whenNotPaused nonReentrant {
        require(orders[_orderId].active == true, "Given ID is invalid");
        require(orders[_orderId].owner == msg.sender, "You are not the owner");

        if (orders[_orderId].is1155 == true) {
            IERC1155Upgradeable(orders[_orderId].assetAddress).safeTransferFrom(
                    address(this),
                    msg.sender,
                    orders[_orderId].tokenId,
                    1,
                    "0x00"
                );
        } else {
            IERC721Upgradeable(orders[_orderId].assetAddress).safeTransferFrom(
                address(this),
                msg.sender,
                orders[_orderId].tokenId
            );
        }

        orders[_orderId].canceled = true;
        orders[_orderId].ended = true;

        emit OrderCanceled(_orderId, msg.sender);
    }

    /// @notice check whether the buyer can swap the NFT against given order ID
    /// @param _orderId ID for the order
    /// @param _assetAddress NFT's contract address want to swap
    /// @param _tokenId NFT's token ID want to swap
    /// @param _proof the proof generated from off-chain
    function eligibleToSwap(
        uint256 _orderId,
        address _assetAddress,
        uint256 _tokenId,
        bytes32[] memory _proof
    ) public view validateId(_orderId) returns (bool) {
        return _eligibleToSwap(_orderId, _assetAddress, _tokenId, _proof);
    }

    /// @notice performs swap the NFT against given order ID
    /// @param _orderId ID for the order
    /// @param _assetAddress NFT's contract address want to swap
    /// @param _tokenId NFT's token ID want to swap
    /// @param _is1155 NFT's ERC1155 flag want to swap
    /// @param _proof the proof generated from off-chain
    function swap(
        uint256 _orderId,
        address _assetAddress,
        uint256 _tokenId,
        bool _is1155,
        bytes32[] memory _proof
    ) public validateId(_orderId) whenNotPaused nonReentrant {
        _swap(_orderId, _assetAddress, _tokenId, _is1155, _proof);

        emit Swapped(
            _orderId,
            msg.sender
        );
    }

    /// @notice performs swap the NFT against given order ID
    /// @param _orderIds ID for the order
    /// @param _assetAddresses NFT's contract address want to swap
    /// @param _tokenIds NFT's token ID want to swap
    /// @param _is1155s NFT's ERC1155 flag want to swap
    /// @param _proofs the proof generated from off-chain
    function swapBatch(
        uint256[] calldata _orderIds,
        address[] calldata _assetAddresses,
        uint256[] calldata _tokenIds,
        bool[] calldata _is1155s,
        bytes32[][] calldata _proofs
    ) public validateIds(_orderIds) whenNotPaused nonReentrant {
        for (uint256 i = 0; i < _orderIds.length; i++) {
            _swap(
                _orderIds[i],
                _assetAddresses[i],
                _tokenIds[i],
                _is1155s[i],
                _proofs[i]
            );
        }

        emit SwappedBatch(
            _orderIds,
            msg.sender
        );
    }

    // pause the contract
    function setPaused() public onlyWhitelisted whenNotPaused {
        _pause();
    }

    // unpause the contract
    function setUnpaused() public onlyWhitelisted whenPaused {
        _unpause();
    }

    function setMaxBatchOrders(uint256 _value) public onlyWhitelisted {
        require(_value != 0, "Invalid value");
        maxBatchOrders = _value;
    }

    // INTERNAL FUNCTIONS

    modifier validateId(uint256 _orderId) {
        require(orders[_orderId].active == true, "Given ID is invalid");
        require(
            orders[_orderId].canceled == false,
            "The order has been cancelled"
        );
        require(
            orders[_orderId].ended == false,
            "The order has been fulfilled"
        );
        _;
    }

    modifier validateIds(uint256[] memory _orderIds) {
        require(maxBatchOrders >= _orderIds.length, "Exceed batch size");
        for (uint256 i = 0; i < _orderIds.length; i++) {
            require(orders[i].active == true, "Given ID is invalid");
            require(
                orders[i].canceled == false,
                "The order has been cancelled"
            );
            require(orders[i].ended == false, "The order has been fulfilled");
        }
        _;
    }

    function _eligibleToSwap(
        uint256 _orderId,
        address _assetAddress,
        uint256 _tokenId,
        bytes32[] memory _proof
    ) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(_assetAddress, _tokenId));
        return
            MerkleProofUpgradeable.verify(_proof, orders[_orderId].root, leaf);
    }

    function _createOrder(
        uint256 _orderId,
        address _assetAddress,
        uint256 _tokenId,
        bool _is1155,
        bytes32 _root
    ) internal {
        require(orders[_orderId].active == false, "Given ID is occupied");

        orders[_orderId].active = true;
        orders[_orderId].assetAddress = _assetAddress;
        orders[_orderId].tokenId = _tokenId;
        orders[_orderId].is1155 = _is1155;
        orders[_orderId].root = _root;
        orders[_orderId].owner = msg.sender;

        if (_is1155 == true) {
            IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                msg.sender,
                address(this),
                _tokenId,
                1,
                "0x00"
            );
        } else {
            IERC721Upgradeable(_assetAddress).safeTransferFrom(
                msg.sender,
                address(this),
                _tokenId
            );
        }
    }

    function _swap(
        uint256 _orderId,
        address _assetAddress,
        uint256 _tokenId,
        bool _is1155,
        bytes32[] memory _proof
    ) internal {
        require(
            _eligibleToSwap(_orderId, _assetAddress, _tokenId, _proof) == true,
            "The caller is not eligible to claim the NFT"
        );

        // taking NFT
        if (_is1155 == true) {
            IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                msg.sender,
                orders[_orderId].owner,
                _tokenId,
                1,
                "0x00"
            );
        } else {
            IERC721Upgradeable(_assetAddress).safeTransferFrom(
                msg.sender,
                orders[_orderId].owner,
                _tokenId
            );
        }

        // giving NFT
        if (orders[_orderId].is1155 == true) {
            IERC1155Upgradeable(orders[_orderId].assetAddress).safeTransferFrom(
                    address(this),
                    msg.sender,
                    orders[_orderId].tokenId,
                    1,
                    "0x00"
                );
        } else {
            IERC721Upgradeable(orders[_orderId].assetAddress).safeTransferFrom(
                address(this),
                msg.sender,
                orders[_orderId].tokenId
            );
        }

        orders[_orderId].ended = true;
    }
}
