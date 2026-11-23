// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PocketTimelock
/// @notice Owner of MUSD Pocket v3. Every admin call (fee change for new goals, fee claim,
///         stray recovery, ownership move) must be queued in public and can only run after
///         `delay` seconds, so savers see any change coming. Goal balances are never reachable
///         by the owner in the first place; the timelock adds notice on top of that.
/// @dev Small, audited-pattern design (Compound Timelock style): queue / cancel / execute
///      keyed by keccak256(target, value, data, eta). The admin and the delay can only be
///      changed through the timelock itself, so those changes wait out the delay too.
contract PocketTimelock {
    uint256 public constant MIN_DELAY = 1 days;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;

    address public admin;
    uint256 public delay;
    mapping(bytes32 => bool) public queued;

    event Queued(bytes32 indexed id, address indexed target, uint256 value, bytes data, uint256 eta);
    event Cancelled(bytes32 indexed id);
    event Executed(bytes32 indexed id, address indexed target, uint256 value, bytes data, uint256 eta);
    event AdminChanged(address indexed admin);
    event DelayChanged(uint256 delay);

    error NotAdmin();
    error NotSelf();
    error BadDelay();
    error ZeroAddress();
    error EtaTooSoon();
    error NotQueued();
    error TooEarly();
    error Stale();
    error CallFailed(bytes reason);

    constructor(address admin_, uint256 delay_) {
        if (admin_ == address(0)) revert ZeroAddress();
        if (delay_ < MIN_DELAY || delay_ > MAX_DELAY) revert BadDelay();
        admin = admin_;
        delay = delay_;
        emit AdminChanged(admin_);
        emit DelayChanged(delay_);
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function txId(address target, uint256 value, bytes calldata data, uint256 eta) public pure returns (bytes32) {
        return keccak256(abi.encode(target, value, data, eta));
    }

    function queue(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        onlyAdmin
        returns (bytes32 id)
    {
        if (eta < block.timestamp + delay) revert EtaTooSoon();
        id = txId(target, value, data, eta);
        queued[id] = true;
        emit Queued(id, target, value, data, eta);
    }

    function cancel(address target, uint256 value, bytes calldata data, uint256 eta) external onlyAdmin {
        bytes32 id = txId(target, value, data, eta);
        if (!queued[id]) revert NotQueued();
        queued[id] = false;
        emit Cancelled(id);
    }

    function execute(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        payable
        onlyAdmin
        returns (bytes memory result)
    {
        bytes32 id = txId(target, value, data, eta);
        if (!queued[id]) revert NotQueued();
        if (block.timestamp < eta) revert TooEarly();
        if (block.timestamp > eta + GRACE_PERIOD) revert Stale();
        queued[id] = false;
        bool ok;
        (ok, result) = target.call{value: value}(data);
        if (!ok) revert CallFailed(result);
        emit Executed(id, target, value, data, eta);
    }

    /// @notice Only callable by the timelock itself (i.e. through queue + execute).
    function setAdmin(address newAdmin) external {
        if (msg.sender != address(this)) revert NotSelf();
        if (newAdmin == address(0)) revert ZeroAddress();
        admin = newAdmin;
        emit AdminChanged(newAdmin);
    }

    function setDelay(uint256 newDelay) external {
        if (msg.sender != address(this)) revert NotSelf();
        if (newDelay < MIN_DELAY || newDelay > MAX_DELAY) revert BadDelay();
        delay = newDelay;
        emit DelayChanged(newDelay);
    }

    receive() external payable {}
}
