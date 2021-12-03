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
import "./interfaces/INFTManager.sol";
import "./interfaces/IShare.sol";

/**
 * @title A contract to collaterizes LP and mints NFT
*/

contract NFTManager is ReentrancyGuard, Whitelist, INFTManager {
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
        // Timestamp
        uint timestamp;
        // Minter who will receive the redeem fee
        address minter;
    }

    struct SyntheticVariant {
        // name of the variant
        string name;
        // token id for this variant
        uint256 tokenId;
        // value
        uint256 tokenValue;
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
    // Collateral share
    IShare public override collateralShare;
    // Collateral share's symbol for price calculation
    bytes32 public collateralShareSymbol;
    // Target currency in the registry
    bytes32 public syntheticSymbol;
    // Synthetic NFT variants
    mapping(uint8 => SyntheticVariant) public syntheticVariants;
    // Total Synthetic NFT variants
    uint8 public syntheticVariantCount;
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
    // Ratio step
    uint256 public ratioStep;

    // Dev address
    address public devAddress;
    // Redeem fees for minter / dev
    uint256 public redeemFeeDev; 
    uint256 public redeemFeeMinter;

    uint256 constant ONE = 1 ether; // 1

    constructor(
        string memory _name,
        string memory _nftUri,
        address _priceResolverAddress,
        address _collateralShareAddress, // LP TOKEN
        bytes32 _collateralShareSymbol, // LP TOKEN
        address _redeemTokenAddress, // TAMG 
        bytes32 _redeemTokenSymbol, // TAMG
        bytes32 _syntheticSymbol,
        address _devAddress
    ) public nonReentrant {

        name = _name;
        syntheticSymbol = _syntheticSymbol; 
        state = ContractState.INITIAL;
        collateralShare = IShare(_collateralShareAddress);
        collateralShareSymbol = _collateralShareSymbol;
        redeemToken = IERC20(_redeemTokenAddress);
        redeemTokenSymbol = _redeemTokenSymbol;
        
        priceResolver = IPriceResolver(_priceResolverAddress);

        globalCollatelizationRatio = 1 ether;  // should be 100% at the start
        ratioStep = 2500000000000000; // 0.25%

        redeemFeeDev = 15000000000000000; // 1.5%
        redeemFeeMinter = 15000000000000000; // 1.5%

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

    function mint() public nonReentrant {

    }

    function redeem() public nonReentrant {
        
    }

    // get price per redeem token
    function getRedeemTokenPrice() public view returns (uint256) {
        require( priceResolver.isValid(redeemTokenSymbol) , "redeemTokenSymbol is not valid");
        return priceResolver.getCurrentPrice(redeemTokenSymbol);
    }
    
    // get price per 1 synthetic token
    function getSyntheticPrice() public view returns (uint256) {
        require( priceResolver.isValid(syntheticSymbol) , "syntheticSymbol is not valid");
        return priceResolver.getCurrentPrice(syntheticSymbol);
    }

    // get price per 1 LP
    function getCollateralSharePrice() public view returns (uint256) {
        require( priceResolver.isValid(collateralShareSymbol) , "collateralShareSymbol is not valid");
        return priceResolver.getCurrentPrice(collateralShareSymbol);
    }

    // ONLY ADMIN CAN PROCEED

    // add NFT variant
    function addSyntheticVariant(
        string memory _name,
        uint256 _tokenId,
        uint256 _tokenValue
    )
        public 
        nonReentrant
        onlyWhitelisted
    {

        syntheticVariants[syntheticVariantCount].name = _name;
        syntheticVariants[syntheticVariantCount].tokenId = _tokenId;
        syntheticVariants[syntheticVariantCount].tokenValue = _tokenValue;

        syntheticVariantCount += 1;
    }

    // enable/disable synthetic NFT variant
    function setSyntheticVariantDisable(uint8 _id, bool _disabled) public nonReentrant onlyWhitelisted {
        require( syntheticVariantCount > _id , "Invalid given _id");
        syntheticVariants[_id].disabled = _disabled;
    }

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

    // update collateral share contract address
    function setCollateralShare(address _address)
        public
        nonReentrant
        onlyWhitelisted
    {
        collateralShare = IShare(_address);
    }

    // update collateral share symbol
    function setCollateralShareSymbol(bytes32 _symbol)
        public 
        nonReentrant
        onlyWhitelisted
    {
        collateralShareSymbol = _symbol;
    }

    // update step ratio
    function setRatioStep(uint256 _ratioStep) 
        public
        nonReentrant
        onlyWhitelisted
    {
        ratioStep = _ratioStep;
    }

    // update redeem fees
    function setRedeemFees(uint256 _minter, uint256 _dev)
        public
        nonReentrant
        onlyWhitelisted
    {
        redeemFeeDev = _dev;
        redeemFeeMinter = _minter;
    }

    // INTERNAL FUNCTIONS

    // Check if the state is ready
    modifier isReady() {
        require((state) == ContractState.NORMAL, "Contract state is not ready");
        _;
    }


}
