// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./TokenFactory.sol";
import "./interfaces/ILeverageSize.sol";
import "./interfaces/IExchangeCore.sol";

contract ExchangeCore is Lockable, Whitelist, ILeverageSize, IExchangeCore {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    enum ContractState {
        NotReady,
        Ready
    }

    struct Pair {
        uint256 index;
        string name;
        bool active;
        address longToken1xAddress;
        address shortToken1xAddress;
        address longToken2xAddress;
        address shortToken2xAddress;
        address longToken4xAddress;
        address shortToken4xAddress;
    }

    struct Pairs {
        uint256[] array;
        mapping(uint256 => Pair) table;
        mapping(address => bool) valid;
    }

    // contract state
    ContractState public state;
    // quote token, sharing across all pairs
    IERC20 public quoteToken;
    // exchange pair registry
    Pairs private _pairs;
    // quote token balance
    uint256 public quoteBalance;
    // trading fee
    uint256 public override fee = 3000000000000000; // 0.3%
    // dev address
    address public override devAddress;

    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    event AddedPair(uint256 pairId);
    event RemovedPair(uint256 pairId);
    event UpdatedPair(
        uint256 pairId,
        uint8 leverageSize,
        address pairLongTokenAddress,
        address pairShortTokenAddress
    );
    event Deposit(address indexed account, address indexed token,  uint256 indexed amount);
    event Withdraw(address indexed account, address indexed token,  uint256 indexed amount);


    constructor(address _quoteTokenAddress, address _devAddress) public nonReentrant() {
        require(_quoteTokenAddress != address(0), "Invalid quoteToken address");

        state = ContractState.NotReady;
        quoteToken = IERC20(_quoteTokenAddress);
        devAddress = _devAddress;

        addAddress(msg.sender);
    }

    function getQuoteToken() public override view returns (address) {
        return address(quoteToken);
    }

    function getQuoteBalance() public override view returns (uint256) {
        return quoteBalance;
    }

    function getPairName(uint256 pairId) public view returns (string memory) {
        return _pairs.table[pairId].name;
    }

    function getPairTokens(uint256 pairId, uint8 size) public view returns (address, address) {
        require(_pairs.array.length > pairId, "Invalid pairId");
        require(size != 0 || !(size > 4), "Invalid given leverage size");
        require(
            size != 3,
            "Given leverage size is not support"
        );

        address pairLongToken;
        address pairShortToken; 

        if (size == 1) {
            pairLongToken = _pairs.table[pairId].longToken1xAddress;
            pairShortToken = _pairs.table[pairId].shortToken1xAddress;
        } else if (size == 2) {
            pairLongToken = _pairs.table[pairId].longToken2xAddress;
            pairShortToken = _pairs.table[pairId].shortToken2xAddress;
        } else if (size == 4) {
            pairLongToken = _pairs.table[pairId].longToken4xAddress;
            pairShortToken = _pairs.table[pairId].shortToken4xAddress;
        }

        return (pairLongToken, pairShortToken);
    }

    function totalPairs() public view returns (uint256) {
        return _pairs.array.length;
    }

    // make a deposit of quote asset from the pair contract only
    function deposit(uint256 amount) external override nonReentrant() isValidPair(msg.sender) {
        require(amount > 0 , "Invalid amount");

        // quoteToken.safeTransferFrom(msg.sender, address(this), amount);
        quoteBalance = quoteBalance.add(amount);
        emit Deposit(msg.sender, address(quoteToken), amount);
    }

    // make a withdrawal of quote asset from the pair contract only
    function withdraw(uint256 amount, address recipient) external override nonReentrant() isValidPair(msg.sender) {
        require(amount > 0 , "Invalid amount");

        quoteToken.safeTransfer(recipient , amount);
        quoteBalance = quoteBalance.sub(amount);
        emit Withdraw(recipient , address(quoteToken), amount);
    }

    // enable this contract
    function enable() public nonReentrant() onlyWhitelisted() {
        require(state != ContractState.Ready, "Invalid state");
        state = ContractState.Ready;
    }

    // disable this contract
    function disable() public nonReentrant() onlyWhitelisted() {
        require(state != ContractState.NotReady, "Invalid state");
        state = ContractState.NotReady;
    }

    // set trading fee
    function setFee(uint256 feeAmount) public nonReentrant() onlyWhitelisted() {
        require(feeAmount >= 0 && 100000000000000000 >= feeAmount, "Fee amount must be between 0%-10% ");
        fee = feeAmount;
    }

    // add new exchange pair
    function addPair(string memory _name)
        public
        nonReentrant()
        isReady()
        onlyWhitelisted()
    {
        uint256 index = _pairs.array.length;
        _pairs.array.push(index);
        Pair storage pair = _pairs.table[index];
        pair.index = index;
        pair.name = _name;
        pair.active = true;

        emit AddedPair(index);
    }

    // remove an exchange pair
    function removePair(uint256 pairId)
        public
        nonReentrant()
        isReady()
        onlyWhitelisted()
    {
        require(_pairs.array.length > pairId, "Invalid pairId");
        _pairs.table[pairId].active = false;

        // FIXME: Remove pairs from valid list

        emit RemovedPair(pairId);
    }

    // setup leveraged token addresses
    function setLeveragedTokenAddress(
        uint256 pairId,
        uint8 size,
        address pairLongTokenAddress,
        address pairShortTokenAddress
    ) public nonReentrant() isReady() onlyWhitelisted() {
        require(_pairs.array.length > pairId, "Invalid pairId");
        require(size != 0 || !(size > 4), "Invalid given leverage size");
        require(
            size != 3,
            "Given leverage size is not support"
        );

        if (size == 1) {
            _pairs.table[pairId].longToken1xAddress = pairLongTokenAddress;
            _pairs.table[pairId].shortToken1xAddress = pairShortTokenAddress;
        } else if (size == 2) {
            _pairs.table[pairId].longToken2xAddress = pairLongTokenAddress;
            _pairs.table[pairId].shortToken2xAddress = pairShortTokenAddress;
        } else if (size == 4) {
            _pairs.table[pairId].longToken4xAddress = pairLongTokenAddress;
            _pairs.table[pairId].shortToken4xAddress = pairShortTokenAddress;
        }

        _pairs.valid[pairLongTokenAddress] = true;
        _pairs.valid[pairShortTokenAddress] = true;

        quoteToken.approve( pairLongTokenAddress, MAX );
        quoteToken.approve( pairShortTokenAddress, MAX );

        emit UpdatedPair(pairId , size, pairLongTokenAddress, pairShortTokenAddress );
    }

    modifier isReady() {
        require(state != ContractState.NotReady, "Exchange Core is not ready");
        _;
    }

    modifier isValidPair(address _address) {
        require(_pairs.valid[_address] == true, "Given address is not a valid pair");
        _;
    }
}
