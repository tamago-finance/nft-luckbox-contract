// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./interfaces/IPriceResolver.sol";
import "./interfaces/ITokenManager.sol";
import "./TokenFactory.sol";

contract TokenManager is Lockable, Whitelist, ITokenManager {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;
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
    // Synthetic token created by this contract.
    IExpandedIERC20 public override syntheticToken;
    // Support collateral token (stablecoin)
    IERC20 public override supportCollateralToken;
    // Base collateral token
    IERC20 public override baseCollateralToken;
    // Keep track of synthetic tokens that've been issued
    uint256 public tokenOutstanding;
    // Total collateral that locked in this contract
    RawCollateral public totalRawCollateral;
    // trading fee
    uint256 public mintFee = 0; // 0%
    uint256 public redeemFee = 0; // 0%
    // dev address
    address public devAddress;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    event CreatedSyntheticToken();

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
        supportCollateralToken = IERC20(_supportCollateralTokenAddress);
        baseCollateralToken = IERC20(_baseCollateralTokenAddress);

        devAddress = _devAddress;

        // add dev into the whitelist
        addAddress(_devAddress);

        if (_devAddress != msg.sender) {
            addAddress(msg.sender);
        }

        emit CreatedSyntheticToken();
    }

    // update the contract state
    function setContractState(ContractState _state) public nonReentrant() onlyWhitelisted() {
        state = _state;
    }



    // INTERNAL FUNCTIONS



    // Check if the state is ready
    modifier isReady() {
        require((state) != ContractState.NORMAL , "Contract state is not ready");
        _;
    }


}
