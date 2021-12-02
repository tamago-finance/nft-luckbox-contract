// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./utility/LibMath.sol";
import "./utility/Whitelist.sol";
import "./utility/SyntheticNFT.sol";
import "./interfaces/IPriceResolver.sol";
import "./interfaces/ISyntheticNFT.sol";
import "./interfaces/ITokenManager.sol";

/**
 * @title A contract to collaterizes asset and mints NFT
 */

contract TokenManager is ReentrancyGuard, Whitelist, ITokenManager {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;

    using SafeERC20 for IERC20;
    
    // timelock period between mint and redeem
    uint256 TIMELOCK_PERIOD = 2 hours;

    enum ContractState {
        INITIAL,
        NORMAL,
        EMERGENCY,
        EXPIRED
    }

    struct PositionData {
        // NFT's token id issued for the position
        uint256 tokenId;
        // Raw collateral value
        uint256 rawCollateral;
        // Collateral token address
        bytes32 rawCollateralToken;
        // Timestamp
        uint timestamp;
    }

    struct SupportCollateral {
        // the symbol in the price feeder registry
        bytes32 priceFeeder;
        // ERC-20 token address
        address tokenAddress;
        // active status
        bool disabled;
    }

    struct SyntheticVariant {
        // name of the variant
        string name;
        // token id for this variant
        uint256 tokenId;
        // value
        uint256 value;
        // total tokens that been minted
        uint256 totalOutstanding;
        // total tokens that been issued 
        uint256 totalIssued;
        // total tokens that been burnt
        uint256 totalBurnt;
        // active status
        bool disabled;
    }

    // Name of the contract
    string public name;
    // Contract state
    ContractState public state;
    // Price resolver contract.
    IPriceResolver public priceResolver;
    // Synthetic NFT created by this contract.
    ISyntheticNFT public override syntheticNFT;
    // Support collateral assets
    mapping(uint8 => SupportCollateral) public supportCollaterals;
    // Total support collaterals 
    uint8 public supportCollateralCount;
    // Target currency in the registry
    bytes32 public syntheticSymbol;
    // Synthetic NFT variants
    mapping(uint256 => SyntheticVariant) public syntheticVariants;
    // Outstanding NFTs
    mapping(uint256 => uint256) public outstandingNfts;
    // Total raw collateral
    mapping(uint8 => uint256) public totalRawCollateral;
    // Redeem token
    IERC20 public redeemToken;
    // Redeem token's symbol for price calculation
    bytes32 public redeemTokenSymbol;
    // Global collatelization ratio
    uint256 public globalCollatelizationRatio;

    // Dev address
    address devAddress;

    uint256 constant ONE = 1 ether; // 1

    constructor(
        string memory _name,
        string memory _nftUri,
        address _priceResolverAddress,
        address _redeemTokenAddress, // TAMG 
        bytes32 _redeemTokenSymbol, // TAMG
        bytes32 _syntheticSymbol,
        address _devAddress
    ) public nonReentrant {

        name = _name;
        syntheticSymbol = _syntheticSymbol; 
        state = ContractState.INITIAL;
        redeemToken = IERC20(_redeemTokenAddress);
        redeemTokenSymbol = _redeemTokenSymbol;
        
        priceResolver = IPriceResolver(_priceResolverAddress);

        globalCollatelizationRatio = 1 ether;  // should be 100% at the start

        // Deploy the synthetic NFT contract
        SyntheticNFT deployedContract = new SyntheticNFT(_nftUri);
        syntheticNFT = ISyntheticNFT(address(deployedContract));

        devAddress = _devAddress;

        // add dev into the whitelist
        addAddress(_devAddress);

        if (_devAddress != msg.sender) {
            addAddress(msg.sender);
        }

    }

    


    // ONLY ADMIN CAN PROCEED

    // update the contract state
    function setContractState(ContractState _state)
        public
        nonReentrant
        onlyWhitelisted
    {
        state = _state;
    }

    // update the price resolver contract
    function setPriceResolver(address _priceResolverAddress)
        public
        nonReentrant
        onlyWhitelisted
    {
        priceResolver = IPriceResolver(_priceResolverAddress);
    }

    // update the synthetic symbol
    function setSyntheticSymbol(bytes32 _syntheticSymbol)
        public
        nonReentrant
        onlyWhitelisted
    {
        syntheticSymbol = _syntheticSymbol; 
    }

    // update dev address
    function setDevAddress(address _devAddress)
        public
        nonReentrant
        onlyWhitelisted
    {
        devAddress = _devAddress;
    }

    // update NFT uri
    function setNftUri(string memory _uri)
        public 
        nonReentrant
        onlyWhitelisted
    {
        syntheticNFT.setUri(_uri);
    }

    // update redeem token contract address
    function setRedeemTokenAddress(address _address)
        public
        nonReentrant
        onlyWhitelisted
    {
        redeemToken = IERC20(_address);
    }

    // update redeem token symbol
    function setRedeemTokenSymbol(bytes32 _symbol)
        public
        nonReentrant
        onlyWhitelisted
    {
        redeemTokenSymbol = _symbol;
    }

    // INTERNAL FUNCTIONS

    // Check if the state is ready
    modifier isReady() {
        require((state) == ContractState.NORMAL, "Contract state is not ready");
        _;
    }


}
