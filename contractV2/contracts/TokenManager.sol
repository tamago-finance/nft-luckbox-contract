// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./interfaces/IPriceResolver.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/IToken.sol";
import "./TokenFactory.sol";

contract TokenManager is Lockable, Whitelist, ITokenManager {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IToken;
    using SafeERC20 for IExpandedIERC20;

    enum ContractState {
        INITIAL,
        NORMAL,
        EMERGENCY,
        EXPIRED
    }

    struct PositionData {
        // Total tokens have been issued
        uint256 tokensOutstanding;
        // Raw collateral value of base token
        uint256 rawBaseCollateral;
        // Raw collateral value of support token (stablecoin)
        uint256 rawSupportCollateral;
    }

    struct Minters {
        uint256[] array;
        mapping(uint256 => address) list;
        mapping(address => bool) active;
    }

    struct RawCollateral {
        uint256 baseToken;
        uint256 supportToken;
    }

    // Name of this contract (SYNTHETIC_NAME + "Token Manager")
    string public name;
    // Contract state
    ContractState public state;
    // Price feeder contract.
    IPriceResolver public priceResolver;
    // Minter data
    mapping(address => PositionData) public positions;
    // Minters
    Minters private minters;
    // Synthetic token created by this contract.
    IExpandedIERC20 public override syntheticToken;
    // Support collateral token (stablecoin)
    IToken public override supportCollateralToken;
    // Base collateral token
    IToken public override baseCollateralToken;
    // Keep track of synthetic tokens that've been issued
    uint256 public tokenOutstanding;
    // Total collateral that locked in this contract
    RawCollateral public totalRawCollateral;
    // trading fee
    uint256 public mintFee = 0; // 0%
    uint256 public redeemFee = 0; // 0%
    // dev address
    address public devAddress;
    // liquidation ratio
    uint256 public constant liquidationRatio = 1200000000000000000; // 120%
    // Liquidation Incentive Fee 10%
    uint256 public constant liquidationIncentive = 100000000000000000;
    // Debts outstanding
    uint256 public debts;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    event CreatedSyntheticToken();
    event NewMinter(address minter);
    event PositionCreated(
        address minter,
        uint256 baseAmount,
        uint256 supportAmount,
        uint256 syntheticAmount
    );
    event PositionDeleted(address minter);
    event Redeem(
        address minter,
        uint256 baseAmount,
        uint256 supportAmount,
        uint256 syntheticAmount
    );
    event Deposit(
        address indexed minter,
        uint256 baseAmount,
        uint256 supportAmount
    );
    event Withdrawal(
        address indexed minter,
        uint256 baseAmount,
        uint256 supportAmount
    );
    event PositionLiquidated(
        address indexed minter,
        address indexed liquidator,
        uint256 syntheticAmount,
        uint256 baseAmountBack,
        uint256 supportAmountBack
    );
    event PriceResolverUpdated(address contractAddress);

    constructor(
        string memory _name,
        string memory _symbol,
        address _tokenFactoryAddress,
        address _priceResolverAddress,
        address _baseCollateralTokenAddress,
        address _supportCollateralTokenAddress,
        address _devAddress // dev wallet
    ) public nonReentrant() {
        require(
            _tokenFactoryAddress != address(0),
            "Invalid TokenFactory address"
        );
        require(
            _priceResolverAddress != address(0),
            "Invalid PriceResolver address"
        );
        require(
            _baseCollateralTokenAddress != address(0),
            "Invalid BaseCollateralToken address"
        );
        require(
            _supportCollateralTokenAddress != address(0),
            "Invalid SupportCollateralToken address"
        );

        name = string(abi.encodePacked(_name, " Token Manager"));
        state = ContractState.INITIAL;

        // Create the synthetic token
        TokenFactory tf = TokenFactory(_tokenFactoryAddress);
        syntheticToken = tf.createToken(_name, _symbol, 18);

        priceResolver = IPriceResolver(_priceResolverAddress);

        // FIXME : Allow only stablecoin addresses
        supportCollateralToken = IToken(_supportCollateralTokenAddress);
        baseCollateralToken = IToken(_baseCollateralTokenAddress);

        devAddress = _devAddress;

        // add dev into the whitelist
        addAddress(_devAddress);

        if (_devAddress != msg.sender) {
            addAddress(msg.sender);
        }

        emit CreatedSyntheticToken();

        emit PriceResolverUpdated(_priceResolverAddress);
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
        
        emit PriceResolverUpdated(_priceResolverAddress);
    }

    // mint synthetic tokens from the given collateral tokens
    function mint(
        uint256 baseCollateral, // main token
        uint256 supportCollateral, // stablecoin
        uint256 numTokens // synthetic tokens to be minted
    ) public isReady nonReentrant {
        require(baseCollateral >= 0, "baseCollateral must be greater than 0");
        require(
            supportCollateral >= 0,
            "supportCollateral must be greater than 0"
        );
        require(numTokens > 0, "numTokens must be greater than 0");

        PositionData storage positionData = positions[msg.sender];

        require(
            _checkCollateralization(
                positionData.rawBaseCollateral.add(baseCollateral),
                positionData.rawSupportCollateral.add(supportCollateral),
                positionData.tokensOutstanding.add(numTokens)
            ),
            "Position below than collateralization ratio"
        );

        if (positionData.tokensOutstanding == 0) {
            emit NewMinter(msg.sender);

            if (!minters.active[msg.sender]) {
                minters.active[msg.sender] = true;
                uint256 index = minters.array.length;
                minters.array.push(index);
                minters.list[index] = msg.sender;
            }
        }

        // Increase the position and global collateral balance by collateral amount.
        _incrementCollateralBalances(
            positionData,
            baseCollateral,
            supportCollateral
        );

        // Add the number of tokens created to the position's outstanding tokens.
        positionData.tokensOutstanding = positionData.tokensOutstanding.add(
            numTokens
        );

        tokenOutstanding = tokenOutstanding.add(numTokens);

        emit PositionCreated(
            msg.sender,
            baseCollateral,
            supportCollateral,
            numTokens
        );

        // Transfer tokens into the contract from caller and mint corresponding synthetic tokens to the caller's address.
        if (baseCollateral > 0) {
            baseCollateralToken.safeTransferFrom(
                msg.sender,
                address(this),
                baseCollateral
            );
        }
        
        if (supportCollateral > 0) {
            supportCollateralToken.safeTransferFrom(
                msg.sender,
                address(this),
                supportCollateral
            );
        }
        
        require(
            syntheticToken.mint(msg.sender, numTokens),
            "Minting synthetic tokens failed"
        );
    }

    // increase collateralization ratio by deposit more collateral
    function deposit(
        uint256 baseCollateral, // main token
        uint256 supportCollateral // stablecoin
    ) public isReady nonReentrant {
        PositionData storage positionData = positions[msg.sender];

        require(
            _checkCollateralization(
                positionData.rawBaseCollateral.add(baseCollateral),
                positionData.rawSupportCollateral.add(supportCollateral),
                positionData.tokensOutstanding
            ),
            "Position below than collateralization ratio"
        );

        // Increase the position and collateral balance by collateral amount.
        _incrementCollateralBalances(
            positionData,
            baseCollateral,
            supportCollateral
        );

        emit Deposit(msg.sender, baseCollateral, supportCollateral);

        // Move collateral tokens from sender to contract.
        baseCollateralToken.safeTransferFrom(
            msg.sender,
            address(this),
            baseCollateral
        );
        supportCollateralToken.safeTransferFrom(
            msg.sender,
            address(this),
            supportCollateral
        );
    }

    // decrease collateralization ratio by withdraw some collateral as long as the new postion above the liquidation ratio
    function withdraw(
        uint256 baseCollateral, // main token
        uint256 supportCollateral // stablecoin
    ) public isReady nonReentrant {
        PositionData storage positionData = positions[msg.sender];

        require(
            positionData.rawBaseCollateral >= baseCollateral,
            "Insufficient base collateral tokens amount"
        );
        require(
            positionData.rawSupportCollateral >= supportCollateral,
            "Insufficient support collateral tokens amount"
        );

        require(
            _checkCollateralization(
                positionData.rawBaseCollateral.sub(baseCollateral),
                positionData.rawSupportCollateral.sub(supportCollateral),
                positionData.tokensOutstanding
            ),
            "Position below than collateralization ratio"
        );

        // Decrement the minter's collateral and global collateral amounts.
        _decrementCollateralBalances(
            positionData,
            baseCollateral,
            supportCollateral
        );

        emit Withdrawal(msg.sender, baseCollateral, supportCollateral);

        // Transfer collateral from contract to minter
        baseCollateralToken.safeTransfer(msg.sender, baseCollateral);
        supportCollateralToken.safeTransfer(msg.sender, supportCollateral);
    }

    // redeem synthetic tokens back to the minter
    function redeem(
        uint256 baseCollateral, // main token
        uint256 supportCollateral, // stablecoin
        uint256 numTokens // synthetic tokens to be redeemed
    ) public isReady nonReentrant {
        require(numTokens > 0, "numTokens must be greater than 0");

        PositionData storage positionData = positions[msg.sender];

        require(
            positionData.rawBaseCollateral >= baseCollateral,
            "Insufficient base collateral tokens amount"
        );
        require(
            positionData.rawSupportCollateral >= supportCollateral,
            "Insufficient support collateral tokens amount"
        );
        require(
            positionData.tokensOutstanding >= numTokens,
            "Insufficient synthetics amount"
        );

        require(
            _checkCollateralization(
                positionData.rawBaseCollateral.sub(baseCollateral),
                positionData.rawSupportCollateral.sub(supportCollateral),
                positionData.tokensOutstanding.sub(numTokens)
            ),
            "Position below than collateralization ratio"
        );

        // Decrement the minter's collateral and global collateral amounts.
        _decrementCollateralBalances(
            positionData,
            baseCollateral,
            supportCollateral
        );

        positionData.tokensOutstanding = positionData.tokensOutstanding.sub(
            numTokens
        );
        tokenOutstanding = tokenOutstanding.sub(numTokens);

        emit Redeem(msg.sender, baseCollateral, supportCollateral, numTokens);

        // Transfer collateral from contract to caller and burn callers synthetic tokens.
        baseCollateralToken.safeTransfer(msg.sender, baseCollateral);
        supportCollateralToken.safeTransfer(msg.sender, supportCollateral);

        syntheticToken.safeTransferFrom(msg.sender, address(this), numTokens);
        syntheticToken.burn(numTokens);
    }

    // burn all synthetic tokens and send collateral tokens back to the minter
    function redeemAll() public isReadyOrEmergency nonReentrant {
        PositionData storage positionData = positions[msg.sender];

        emit Redeem(
            msg.sender,
            positionData.rawBaseCollateral,
            positionData.rawSupportCollateral,
            positionData.tokensOutstanding
        );

        // Transfer collateral from contract to minter and burn synthetic tokens.
        supportCollateralToken.safeTransfer(
            msg.sender,
            positionData.rawSupportCollateral
        );
        baseCollateralToken.safeTransfer(
            msg.sender,
            positionData.rawBaseCollateral
        );

        syntheticToken.safeTransferFrom(
            msg.sender,
            address(this),
            positionData.tokensOutstanding
        );
        syntheticToken.burn(positionData.tokensOutstanding);

        // delete the position
        _deleteSponsorPosition(msg.sender);
    }

    // estimate min. base and support tokens require to mint the given synthetic tokens
    function estimateTokensIn(uint256 numTokens)
        public
        view
        returns (uint256, uint256)
    {
        uint256 currentRate = priceResolver.getCurrentPrice();
        uint256 currentBaseRate = priceResolver.getCurrentPriceCollateral();

        uint256 totalCollateralNeed = numTokens.wmul(currentRate);
        // multiply by liquidation ratio
        totalCollateralNeed = totalCollateralNeed.wmul(liquidationRatio);

        // find suitable mint ratio from historical prices ( ratio = latestPrice / (average 30d + average 60d) )
        uint256 mintRatio = priceResolver.getCurrentRatio();
        uint256 baseCollateralNeed = totalCollateralNeed.wmul(mintRatio);

        uint256 supportCollateralNeed = totalCollateralNeed.wmul(
            ONE.sub(mintRatio)
        );

        // convert base from usd
        baseCollateralNeed = baseCollateralNeed.wdiv(currentBaseRate);

        uint256 adjustedBaseCollateralNeed = _adjustBaseAmountBack(
            baseCollateralNeed
        );
        uint256 adjustedSupportCollateralNeed = _adjustSupportAmountBack(
            supportCollateralNeed
        );

        return (adjustedBaseCollateralNeed, adjustedSupportCollateralNeed);
    }

    // estimate synthetic tokens to be redeemed from the given base and support collateral tokens
    function estimateTokensOut(
        address minter,
        uint256 baseCollateral,
        uint256 supportCollateral
    ) public view returns (uint256) {
        PositionData storage positionData = positions[minter];

        require(
            positionData.rawBaseCollateral >= baseCollateral,
            "Insufficient base collateral tokens amount"
        );
        require(
            positionData.rawSupportCollateral >= supportCollateral,
            "Insufficient support collateral tokens amount"
        );

        uint256 currentRatio = _getCollateralizationRatio(
            positionData.rawBaseCollateral,
            positionData.rawSupportCollateral,
            positionData.tokensOutstanding
        );

        return
            _calculateSyntheticRedeemed(baseCollateral, supportCollateral).wdiv(
                currentRatio
            );
    }

    // calculate the collateralization ratio from the given amounts
    function getCollateralizationRatio(
        uint256 baseCollateral, // main token
        uint256 supportCollateral, // stablecoin
        uint256 numTokens // synthetic tokens to be minted
    ) public view returns (uint256) {
        return
            _getCollateralizationRatio(
                baseCollateral,
                supportCollateral,
                numTokens
            );
    }

    // return the caller's collateralization ratio
    function myCollateralizationRatio() public view returns (uint256 ratio) {
        PositionData storage positionData = positions[msg.sender];
        return
            _getCollateralizationRatio(
                positionData.rawBaseCollateral,
                positionData.rawSupportCollateral,
                positionData.tokensOutstanding
            );
    }

    // return the caller position's outstanding synthetic tokens
    function myTokensOutstanding()
        public
        view
        returns (uint256 tokensOutstanding)
    {
        PositionData storage positionData = positions[msg.sender];
        return positionData.tokensOutstanding;
    }

    // return the caller position's collateral tokens
    function myTokensCollateral()
        public
        view
        returns (uint256 baseCollateral, uint256 supportCollateral)
    {
        PositionData storage positionData = positions[msg.sender];
        return (
            positionData.rawBaseCollateral,
            positionData.rawSupportCollateral
        );
    }

    // total minter in the system
    function totalMinter() public view returns (uint256) {
        return minters.array.length;
    }

    // return minter's address from given index
    function minterAddress(uint256 _index) public view returns (address) {
        return minters.list[_index];
    }

    // check whether the given address is minter or not
    function isMinter(address _minter) public view returns (bool) {
        return minters.active[_minter];
    }

    // check the synthetic token price
    function getSyntheticPrice() public view returns (uint256) {
        return priceResolver.getCurrentPrice();
    }

    // check base collateral token price
    function getBaseCollateralPrice() public view returns (uint256) {
        return priceResolver.getCurrentPriceCollateral();
    }

    // check support collateral token price
    function getSupportCollateralPrice() public pure returns (uint256) {
        // FIXME: Fetch the actual value
        return ONE;
    }

    // check current mint ratio
    function getMintRatio() public view returns (uint256) {
        return priceResolver.getCurrentRatio();
    }

    // return the collateralization ratio of the given address
    function collateralizationRatioOf(address minter)
        public
        view
        returns (uint256 ratio)
    {
        PositionData storage positionData = positions[minter];
        return
            _getCollateralizationRatio(
                positionData.rawBaseCollateral,
                positionData.rawSupportCollateral,
                positionData.tokensOutstanding
            );
    }

    // return deposited collaterals of the given address
    function tokensCollateralOf(address minter)
        public
        view
        returns (uint256, uint256)
    {
        PositionData storage positionData = positions[minter];
        return (
            positionData.rawBaseCollateral,
            positionData.rawSupportCollateral
        );
    }

    // check whether the given address can be liquidated or not
    function checkLiquidate(address minter)
        public
        view
        returns (bool, uint256)
    {
        PositionData storage positionData = positions[minter];

        uint256 currentRatio = _getCollateralizationRatio(
            positionData.rawBaseCollateral,
            positionData.rawSupportCollateral,
            positionData.tokensOutstanding
        );

        if (liquidationRatio > currentRatio) {
            // find no. of synthetic tokens require to liquidate the position
            uint256 remainingCollateralBase = positionData.rawBaseCollateral;
            uint256 remainingCollateralSupport = positionData.rawSupportCollateral;
            uint256 discountBase = remainingCollateralBase.wmul( liquidationIncentive );
            uint256 discountSupport = remainingCollateralSupport.wmul( liquidationIncentive );
            remainingCollateralBase = remainingCollateralBase.sub(discountBase);
            remainingCollateralSupport = remainingCollateralSupport.sub(discountSupport);

            uint256 synthsNeed = _calculateSyntheticRedeemed(remainingCollateralBase , remainingCollateralSupport);
            return (true, synthsNeed);
        } else {
            return (false, 0);
        }
    }

    // liquidate the minter's position 
    function liquidate( 
        address minter, // address of the minter to be liquidated
        uint256 maxNumTokens // max amount of synthetic tokens that effort to burn
    ) public isReadyOrEmergency nonReentrant {
        // Retrieve Position data for minter
        PositionData storage positionData = positions[minter];

        require(
            _checkCollateralization(
                positionData.rawBaseCollateral,
                positionData.rawSupportCollateral,
                positionData.tokensOutstanding
            ) == false,
            "Position above than liquidation ratio"
        );

        uint256 remainingCollateralBase = positionData.rawBaseCollateral;
        uint256 remainingCollateralSupport = positionData.rawSupportCollateral;
        uint256 discountBase = remainingCollateralBase.wmul( liquidationIncentive );
        uint256 discountSupport = remainingCollateralSupport.wmul( liquidationIncentive );
        remainingCollateralBase = remainingCollateralBase.sub(discountBase);
        remainingCollateralSupport = remainingCollateralSupport.sub(discountSupport);

        uint256 totalBurnt = _calculateSyntheticRedeemed(remainingCollateralBase , remainingCollateralSupport);

        require( maxNumTokens >= totalBurnt , "Exceeding given maxNumtokens" );

        if ( positionData.tokensOutstanding > totalBurnt ) {
            // keep tack of debts
            debts = debts.add( positionData.tokensOutstanding.sub(totalBurnt));
        }

        // pay incentives + collateral tokens to liquidator
        supportCollateralToken.safeTransfer(
            msg.sender,
            positionData.rawSupportCollateral
        );
        baseCollateralToken.safeTransfer(
            msg.sender,
            positionData.rawBaseCollateral
        );

        // transfer synthetic tokens from liquidator to burn here
        syntheticToken.safeTransferFrom(msg.sender, address(this), totalBurnt);
        syntheticToken.burn(totalBurnt);

        emit PositionLiquidated(
            minter,
            msg.sender,
            totalBurnt,
            positionData.rawBaseCollateral,
            positionData.rawSupportCollateral
        );

        // delete the position
        totalRawCollateral.baseToken = totalRawCollateral.baseToken.sub(
            positionData.rawBaseCollateral
        );
        totalRawCollateral.supportToken = totalRawCollateral.supportToken.sub(
            positionData.rawSupportCollateral
        );

        tokenOutstanding = tokenOutstanding.sub( totalBurnt );
        // Reset the sponsors position to have zero outstanding and collateral.
        delete positions[minter];
    }

    // repay debts 
    function repayDebt(uint256 amount) public nonReentrant {
        require( debts >= amount , "Amount > Outstanding debts" );

        debts = debts.sub( amount );

        syntheticToken.safeTransferFrom(msg.sender, address(this), amount);
        syntheticToken.burn(amount);
    }

    // INTERNAL FUNCTIONS

    function _getCollateralizationRatio(
        uint256 baseCollateral,
        uint256 supportCollateral,
        uint256 numTokens
    ) internal view returns (uint256) {
        baseCollateral = _adjustBaseAmount(baseCollateral);
        supportCollateral = _adjustSupportAmount(supportCollateral);

        uint256 currentRate = priceResolver.getCurrentPrice();
        uint256 currentBaseRate = priceResolver.getCurrentPriceCollateral();

        uint256 baseAmount = baseCollateral.wmul(currentBaseRate);
        uint256 totalCollateral = baseAmount.add(supportCollateral);

        return (totalCollateral.wdiv(currentRate)).wdiv(numTokens);
    }

    function _checkCollateralization(
        uint256 baseCollateral,
        uint256 supportCollateral,
        uint256 numTokens
    ) internal view returns (bool) {
        uint256 minRatio = liquidationRatio;

        uint256 thisChange = _getCollateralizationRatio(
            baseCollateral,
            supportCollateral,
            numTokens
        );

        return !(minRatio > (thisChange));
    }

    function _calculateSyntheticRedeemed(
        uint256 baseCollateral,
        uint256 supportCollateral
    ) internal view returns (uint256) {
        baseCollateral = _adjustBaseAmount(baseCollateral);
        supportCollateral = _adjustSupportAmount(supportCollateral);

        uint256 currentRate = priceResolver.getCurrentPrice();
        uint256 currentBaseRate = priceResolver.getCurrentPriceCollateral();

        uint256 baseAmount = baseCollateral.wmul(currentBaseRate);
        uint256 totalCollateral = baseAmount.add(supportCollateral);

        return (totalCollateral.wdiv(currentRate));
    }

    function _adjustBaseAmount(uint256 amount) internal view returns (uint256) {
        uint8 decimals = baseCollateralToken.decimals();
        return _adjustAmount(amount, decimals);
    }

    function _adjustSupportAmount(uint256 amount)
        internal
        view
        returns (uint256)
    {
        uint8 decimals = supportCollateralToken.decimals();
        return _adjustAmount(amount, decimals);
    }

    function _adjustAmount(uint256 amount, uint8 decimals)
        internal
        pure
        returns (uint256)
    {
        if (decimals == 18) {
            return amount;
        } else {
            uint8 remainingDecimals = 18 - decimals;
            uint256 multiplier = 10**uint256(remainingDecimals);
            return amount.mul(multiplier);
        }
    }

    function _adjustBaseAmountBack(uint256 amount)
        internal
        view
        returns (uint256)
    {
        uint8 decimals = baseCollateralToken.decimals();
        return _adjustAmountBack(amount, decimals);
    }

    function _adjustSupportAmountBack(uint256 amount)
        internal
        view
        returns (uint256)
    {
        uint8 decimals = supportCollateralToken.decimals();
        return _adjustAmountBack(amount, decimals);
    }

    function _adjustAmountBack(uint256 amount, uint8 decimals)
        internal
        pure
        returns (uint256)
    {
        if (decimals == 18) {
            return amount;
        } else {
            uint8 remainingDecimals = 18 - decimals;
            uint256 multiplier = 10**uint256(remainingDecimals);
            return amount.div(multiplier);
        }
    }

    function _incrementCollateralBalances(
        PositionData storage positionData,
        uint256 baseCollateral,
        uint256 supportCollateral
    ) internal {
        positionData.rawBaseCollateral = positionData.rawBaseCollateral.add(
            baseCollateral
        );
        positionData.rawSupportCollateral = positionData
            .rawSupportCollateral
            .add(supportCollateral);

        totalRawCollateral.baseToken = totalRawCollateral.baseToken.add(
            baseCollateral
        );
        totalRawCollateral.supportToken = totalRawCollateral.supportToken.add(
            supportCollateral
        );
    }

    function _decrementCollateralBalances(
        PositionData storage positionData,
        uint256 baseCollateral,
        uint256 supportCollateral
    ) internal {
        positionData.rawBaseCollateral = positionData.rawBaseCollateral.sub(
            baseCollateral
        );
        positionData.rawSupportCollateral = positionData
            .rawSupportCollateral
            .sub(supportCollateral);

        totalRawCollateral.baseToken = totalRawCollateral.baseToken.sub(
            baseCollateral
        );
        totalRawCollateral.supportToken = totalRawCollateral.supportToken.sub(
            supportCollateral
        );
    }

    function _deleteSponsorPosition(address _minter) internal {
        PositionData storage positionToLiquidate = positions[_minter];

        totalRawCollateral.baseToken = totalRawCollateral.baseToken.sub(
            positionToLiquidate.rawBaseCollateral
        );
        totalRawCollateral.supportToken = totalRawCollateral.supportToken.sub(
            positionToLiquidate.rawSupportCollateral
        );

        tokenOutstanding = tokenOutstanding.sub(
            positionToLiquidate.tokensOutstanding
        );

        // Reset the sponsors position to have zero outstanding and collateral.
        delete positions[_minter];

        emit PositionDeleted(_minter);
    }

    // Check if the state is ready
    modifier isReady() {
        require((state) == ContractState.NORMAL, "Contract state is not ready");
        _;
    }

    // Only Ready and Emergency
    modifier isReadyOrEmergency() {
        require(
            (state) == ContractState.NORMAL ||
                (state) == ContractState.EMERGENCY,
            "Contract state is not either ready or emergency"
        );
        _;
    }
}
