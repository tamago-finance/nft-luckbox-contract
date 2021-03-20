// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./interfaces/IPriceFeeder.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IPmm.sol";
import "./TokenFactory.sol";

/**
 * @title PMM contract
 */

contract Pmm is Lockable, Whitelist, IPmm {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    
    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // Base ERC20 token 
    IERC20 public override baseToken;
    // Quote ERC20 token 
    IERC20 public override quoteToken;
    // Share tokens created by this contract.
    IExpandedIERC20 public override baseCapitalToken;
    IExpandedIERC20 public override quoteCapitalToken;
    // Variables for PMM Algorithm
    uint256 public k;
    uint256 public lpFeeRate;
    uint256 public mtFeeRate;
    


    event CreatedPMM();
    
    constructor(
        address _tokenFactoryAddress,
        address _baseToken,
        address _quoteToken,
        address _priceFeeder,
        uint256 _lpFeeRate,
        uint256 _mtFeeRate,
        uint256 _k
    ) public nonReentrant() {
        require(address(_priceFeeder) != address(0), "Invalid PriceFeeder address");
        require(address(_quoteToken) != address(0), "Invalid QuoteToken address");
        require(address(_baseToken) != address(0), "Invalid BaseToken address");

        priceFeeder = IPriceFeeder(_priceFeeder);
        baseToken = IERC20(_baseToken);
        quoteToken = IERC20(_quoteToken);

        // Setup LP tokens
        TokenFactory tf = TokenFactory(_tokenFactoryAddress);
        baseCapitalToken = tf.createToken("BASE_TLP", "TLP", 18);
        quoteCapitalToken = tf.createToken("QUOTE_TLP", "TLP", 18);

        k = _k;
        lpFeeRate = _lpFeeRate;
        mtFeeRate = _mtFeeRate;

        addAddress(msg.sender);
        emit CreatedPMM();

        _valiateParameters();
    }




    // INTERNAL FUCTIONS
    function _valiateParameters() internal view returns (uint256) {
        require(k < 1000000000000000000, "K>=1");
        require(k > 0, "K=0");
        require(lpFeeRate.add(mtFeeRate) < 1000000000000000000, "FEE_RATE>=1");
    }

}