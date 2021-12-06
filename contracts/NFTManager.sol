// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";

import "./utility/LibMath.sol";
import "./utility/Whitelist.sol";
import "./utility/SyntheticNFT.sol";
import "./interfaces/IPriceResolver.sol";
import "./interfaces/ISyntheticNFT.sol";
import "./interfaces/INFTManager.sol";
import "./interfaces/IPancakePair.sol";

/**
 * @title A contract to collaterizes LP and mints NFT
 */

contract NFTManager is ReentrancyGuard, Whitelist, INFTManager, ERC1155Holder {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;

    using SafeERC20 for IERC20;

    enum ContractState {
        INITIAL,
        NORMAL,
        EMERGENCY,
        EXPIRED
    }

    struct SyntheticVariant {
        // name of the variant
        string name;
        // token id for this variant
        uint256 tokenId;
        // value
        uint256 tokenValue;
        // raw collateral on this variant
        uint256 totalRawCollateral;
        // total tokens that been minted
        uint256 totalOutstanding;
        // total tokens that been issued
        uint256 totalIssued;
        // total tokens that been burnt
        uint256 totalBurnt;
        // active status
        bool disabled;
    }

    struct Minter {
        mapping(uint8 => uint256) amount;
        uint timestamp;
        uint256 redeemClaimed;
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
    IPancakePair public override collateralShare;
    // Collateral share's symbol for price calculation
    bytes32 public collateralShareSymbol;
    // Target currency in the registry
    bytes32 public syntheticSymbol;
    // Synthetic NFT variants
    mapping(uint8 => SyntheticVariant) public syntheticVariants;
    // Total Synthetic NFT variants
    uint8 public syntheticVariantCount;
    // Track minter activities
    mapping(address => Minter) private minters;
    // Total raw collateral
    uint256 public totalRawCollateral;
    // Total NFT synthetics outstanding
    uint256 public totalOutstanding;
    // Redeem token
    IERC20 public redeemToken;
    // Redeem token's symbol for price calculation
    bytes32 public redeemTokenSymbol;

    // Dev address
    address public devAddress;
    // Redeem fee
    uint256 public redeemFee;

    // cooldown period before the minter can mint again
    uint256 COOLDOWN_PERIOD = 1 minutes;
    // max collateral ratio before the offset / bonus in place
    uint256 MAX_COLLATERAL_RATIO = 1 ether; // 100%
    // max NFT that can be minted per time
    uint256 MAX_NFT = 20;

    uint256 constant ONE = 1 ether; // 1

    event PositionCreated(
        address minter,
        uint8 variantId,
        uint256 tokenValue,
        uint256 collateralAmount,
        uint256 tokenAmount
    );

    event PositionRemoved(
        address minter,
        uint8 variantId,
        uint256 tokenValue,
        uint256 collateralAmount,
        uint256 tokenAmount
    );

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
        collateralShare = IPancakePair(_collateralShareAddress);
        collateralShareSymbol = _collateralShareSymbol;
        redeemToken = IERC20(_redeemTokenAddress);
        redeemTokenSymbol = _redeemTokenSymbol;

        priceResolver = IPriceResolver(_priceResolverAddress);

        redeemFee = 30000000000000000; // 3.0%

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

    function mint(uint8 _id, uint256 _tokenAmount) public nonReentrant isReady {
        require(syntheticVariantCount > _id, "Invalid given _id");
        require(
            syntheticVariants[_id].disabled == false,
            "The given _id is disabled"
        );



    }

    function estimateMint(uint8 _id, uint256 _tokenAmount) public view returns (uint256) {
        require(syntheticVariantCount > _id, "Invalid given _id");
        require(
            syntheticVariants[_id].disabled == false,
            "The given _id is disabled"
        );
        require( _tokenAmount != 0, "_tokenAmount can't be zero");
        require( MAX_NFT >= _tokenAmount , "Exceed MAX_NFT");
        
        


    }

    function redeem() public nonReentrant {}

    // get price per redeem token
    function getRedeemTokenPrice() public view returns (uint256) {
        require(
            priceResolver.isValid(redeemTokenSymbol),
            "redeemTokenSymbol is not valid"
        );
        return priceResolver.getCurrentPrice(redeemTokenSymbol);
    }

    // get price per 1 synthetic token
    function getSyntheticPrice() public view returns (uint256) {
        require(
            priceResolver.isValid(syntheticSymbol),
            "syntheticSymbol is not valid"
        );
        return priceResolver.getCurrentPrice(syntheticSymbol);
    }

    // get price per 1 LP
    function getCollateralSharePrice() public view returns (uint256) {
        require(
            priceResolver.isValid(collateralShareSymbol),
            "collateralShareSymbol is not valid"
        );
        return priceResolver.getCurrentPrice(collateralShareSymbol);
    }

    // total token that the given minter has been minted
    function getMinterAmount(address _minter, uint8 _id) public view returns (uint256) {
        return minters[_minter].amount[_id];
    }

    // check global CR for this synthetic NFT
    function globalCollatelizationRatio() public view returns (uint256) {
        require( totalRawCollateral > 0, "No collaterals in the contract");
        return _calculateCollateralizationRatio( totalRawCollateral, totalOutstanding );
    }

    // check CR for each variant
    function variantCollatelizationRatio(uint8 _id)
        public
        view
        returns (uint256)
    {
        require(syntheticVariantCount > _id, "Invalid given _id");

        if (syntheticVariants[_id].totalRawCollateral > 0) {
            return _calculateCollateralizationRatio( syntheticVariants[_id].totalRawCollateral, syntheticVariants[_id].totalOutstanding );
        } else {
            // return 100% when no collaterals
            return 1 ether;
        }
    }

    // ONLY ADMIN CAN PROCEED

    // add NFT variant
    function addSyntheticVariant(
        string memory _name,
        uint256 _tokenId,
        uint256 _tokenValue
    ) public nonReentrant onlyWhitelisted {
        syntheticVariants[syntheticVariantCount].name = _name;
        syntheticVariants[syntheticVariantCount].tokenId = _tokenId;
        syntheticVariants[syntheticVariantCount].tokenValue = _tokenValue;

        syntheticVariantCount += 1;
    }

    // enable/disable synthetic NFT variant
    function setSyntheticVariantDisable(uint8 _id, bool _disabled)
        public
        nonReentrant
        onlyWhitelisted
    {
        require(syntheticVariantCount > _id, "Invalid given _id");
        syntheticVariants[_id].disabled = _disabled;
    }

    // emergency withdraw ERC-20 tokens out of the contract
    function withdrawErc20(address _tokenAddress, uint256 _amount)
        public
        nonReentrant
        onlyWhitelisted
    {
        IERC20(_tokenAddress).transfer(msg.sender, _amount);
    }

    // force mint ERC-1155
    function forceMint(uint8 _id, uint256 _collateralAmount, uint256 _tokenAmount)
        public
        nonReentrant
        onlyWhitelisted
    {
        require(syntheticVariantCount > _id, "Invalid given _id");
        require(
            syntheticVariants[_id].disabled == false,
            "The given _id is disabled"
        );
        require( _tokenAmount != 0, "_tokenAmount can't be zero");
        require( MAX_NFT >= _tokenAmount , "Exceed MAX_NFT");

        _createPosition(_id, _collateralAmount, _tokenAmount);

        // FIXME: use safeTransferFrom
        // take collaterals
        collateralShare.transferFrom(
            msg.sender,
            address(this),
            _collateralAmount
        );

        // mint NFT back to the minter
        syntheticNFT.mint(
            msg.sender,
            syntheticVariants[_id].tokenId,
            _tokenAmount,
            _toBytes(0)
        );
    }

    function forceRedeem(uint8 _id, uint256 _collateralAmount, uint256 _tokenAmount)
        public
        nonReentrant
        onlyWhitelisted
    {
        require(syntheticVariantCount > _id, "Invalid given _id");
        require( _tokenAmount != 0, "_tokenAmount can't be zero");
        require( MAX_NFT >= _tokenAmount , "Exceed MAX_NFT");
        
        _removePosition(_id, _collateralAmount, _tokenAmount);

        // burn NFT
        syntheticNFT.safeTransferFrom(
            msg.sender,
            address(this),
            syntheticVariants[_id].tokenId,
            _tokenAmount,
            _toBytes(0)
        );
        syntheticNFT.burn(
            address(this),
            syntheticVariants[_id].tokenId,
            _tokenAmount
        );

        // return collaterals back to the minter
        collateralShare.transfer(
            msg.sender,
            _collateralAmount
        );
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
    function setNftUri(string memory _uri) public nonReentrant onlyWhitelisted {
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
        collateralShare = IPancakePair(_address);
    }

    // update collateral share symbol
    function setCollateralShareSymbol(bytes32 _symbol)
        public
        nonReentrant
        onlyWhitelisted
    {
        collateralShareSymbol = _symbol;
    }

    // update redeem fees
    function setRedeemFee(uint256 _fee)
        public
        nonReentrant
        onlyWhitelisted
    {
        redeemFee = _fee;
    }

    // INTERNAL FUNCTIONS

    // Check if the state is ready
    modifier isReady() {
        require((state) == ContractState.NORMAL, "Contract state is not ready");
        _;
    }

    function _toBytes(uint256 x) internal pure returns (bytes memory b) {
        b = new bytes(32);
        assembly {
            mstore(add(b, 32), x)
        }
    }

    function _createPosition(uint8 _id, uint256 _collateralAmount, uint256 _tokenAmount) internal {
       
        syntheticVariants[_id].totalOutstanding += (syntheticVariants[_id]
            .tokenValue.mul(_tokenAmount));
        syntheticVariants[_id].totalIssued += _tokenAmount;
        syntheticVariants[_id].totalRawCollateral += _collateralAmount;

        minters[msg.sender].amount[_id] += _tokenAmount;
        minters[msg.sender].timestamp = now;

        emit PositionCreated(msg.sender, _id, syntheticVariants[_id].tokenValue, _collateralAmount, _tokenAmount);

        totalRawCollateral = totalRawCollateral.add(_collateralAmount);
        totalOutstanding = totalOutstanding.add(
            syntheticVariants[_id].tokenValue.mul(_tokenAmount)
        );
    }

    function _removePosition(uint8 _id, uint256 _collateralAmount, uint256 _tokenAmount) internal {

        syntheticVariants[_id].totalOutstanding = syntheticVariants[_id].totalOutstanding.sub(syntheticVariants[_id].tokenValue.mul(_tokenAmount));
        syntheticVariants[_id].totalBurnt += _tokenAmount;
        syntheticVariants[_id].totalRawCollateral = syntheticVariants[_id].totalRawCollateral.sub(_collateralAmount);

        minters[msg.sender].amount[_id] = minters[msg.sender].amount[_id].sub(_tokenAmount);
        minters[msg.sender].timestamp = now;

        emit PositionRemoved(msg.sender, _id, syntheticVariants[_id].tokenValue, _collateralAmount, _tokenAmount);

        totalRawCollateral = totalRawCollateral.sub(_collateralAmount);
        totalOutstanding = totalOutstanding.sub(
            syntheticVariants[_id].tokenValue.mul(_tokenAmount)
        );
    }

    function _calculateCollateralizationRatio(
        uint256 collateralAmount,
        uint256 syntheticAmount
    ) internal view returns (uint256) {

        uint256 collateralRate = priceResolver.getCurrentPrice(collateralShareSymbol);
        uint256 syntheticRate = priceResolver.getCurrentPrice(syntheticSymbol);

        uint256 numerator = collateralRate.wmul(collateralAmount);
        uint256 denominator = syntheticRate.wmul(syntheticAmount);

        return numerator.wdiv(denominator);
    }
}
