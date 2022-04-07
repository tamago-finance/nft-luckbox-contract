// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

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
import "./interfaces/IRegistry.sol";

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
    }

    // Registry contract
    IRegistry public registry;
    // Order Id => Order
    mapping(uint256 => Order) public orders;

    event OrderCreated(
        uint256 indexed orderId,
        address assetAddress,
        uint256 tokenId,
        bool is1155,
        address owner,
        bytes32 root
    );

    event OrderCanceled(
        uint256 indexed orderId,
        address owner
    );

    function initialize(
        address _registryAddress,
        address _devAddress
    ) public initializer {
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
		ERC721HolderUpgradeable.__ERC721Holder_init();
		ERC165Upgradeable.__ERC165_init();
		ERC1155HolderUpgradeable.__ERC1155Holder_init();
        PausableUpgradeable.__Pausable_init();
		WhitelistUpgradeable.__Whitelist_init();

        registry = IRegistry(_registryAddress);

        // add dev into the whitelist
        addAddress(_devAddress);

        if (_devAddress != msg.sender) {
            addAddress(msg.sender);
        }

		_registerInterface(IERC721ReceiverUpgradeable.onERC721Received.selector);
	}

    /// @notice create an order and deposit NFT to the contract
	/// @param _orderId ID for the event
    function createOrder(
        uint256 _orderId,
        address _assetAddress,
		uint256 _tokenId,
        bool _is1155,
        bytes32 _root
    ) public nonReentrant {
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

        emit OrderCreated(_orderId, _assetAddress, _tokenId, _is1155, msg.sender, _root);
    }

    /// @notice cancel the order and return NFT back to the original holder
	/// @param _orderId ID that want to cancel
    function cancelOrder(uint256 _orderId) public nonReentrant {
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



}