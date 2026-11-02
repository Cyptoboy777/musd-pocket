// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test doubles for Mezo's MUSD protocol. Unit tests only; the fork test uses the real ones.

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @dev Minimal EIP-2612 MUSD, same domain name/version as Mezo's ("Mezo USD", "1").
contract MockMUSDPermit {
    string public constant name = "Mezo USD";
    string public constant symbol = "MUSD";
    uint8 public constant decimals = 18;
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
    {
        require(block.timestamp <= deadline, "expired");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline))
            )
        );
        address rec = ecrecover(digest, v, r, s);
        require(rec != address(0) && rec == owner, "bad sig");
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/// @dev Stands in for BorrowerOperationsSignatures: "verifies" by a flag and mints to recipient.
contract MockBorrowerOpsSig {
    IMintable public immutable musd;
    MockTroveManager public immutable tm;
    bool public rejectSignatures;
    uint256 public shortBy; // mint less than asked, to test BorrowMismatch
    uint256 public debtPerMusd = 0; // unused, ICR is set directly on the trove manager
    mapping(address => uint256) public nonces;
    address public lastBorrower;
    address public lastRecipient;

    constructor(address musd_, address tm_) {
        musd = IMintable(musd_);
        tm = MockTroveManager(tm_);
    }

    function setReject(bool r) external {
        rejectSignatures = r;
    }

    function setShortBy(uint256 s) external {
        shortBy = s;
    }

    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function withdrawMUSDWithSignature(
        uint256 amount,
        address,
        address,
        address borrower,
        address recipient,
        bytes memory,
        uint256 deadline
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        require(!rejectSignatures, "BorrowerOperationsSignatures: Invalid signature");
        nonces[borrower]++;
        lastBorrower = borrower;
        lastRecipient = recipient;
        musd.mint(recipient, amount - shortBy);
        // Like Mezo's ActivePool.sendCollateral(recipient, 0): a value-0 call to the recipient.
        (bool ok,) = recipient.call{value: 0}("");
        require(ok, "Sending BTC failed");
        tm.onBorrow(borrower);
    }
}

contract MockTroveManager {
    mapping(address => uint256) public icrAfterBorrow;

    function setIcrAfterBorrow(address b, uint256 icr) external {
        icrAfterBorrow[b] = icr;
    }

    function onBorrow(address) external {}

    function getCurrentICR(address b, uint256) external view returns (uint256) {
        return icrAfterBorrow[b];
    }
}

contract MockPriceFeed {
    uint256 public price = 81_000e18;

    function fetchPrice() external view returns (uint256) {
        return price;
    }
}
