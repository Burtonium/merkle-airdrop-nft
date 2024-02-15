// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Contributors} from "./Contributors.sol";

contract MerkleAirdrop is
    ERC721,
    Ownable2Step,
    Multicall,
    Contributors,
    ReentrancyGuard
{
    using BitMaps for BitMaps.BitMap;

    enum State {
        Presale,
        PublicSale,
        SoldOut
    }

    struct Commit {
        bytes32 commitment;
        uint64 blockNumber;
        bool revealed;
    }

    event NFTClaimed(address indexed account, uint256 tokenId);
    event HashCommitted(address sender, bytes32 dataHash, uint64 block);

    uint256 public constant BLOCKS_BEFORE_REVEAL = 10;
    bytes32 public whitelistMerkleRoot =
        0xd178f13658b238eabe23e5aa929690bbd7db7141ecbc36ad190d95d98709aa2b;
    State public currentState;

    BitMaps.BitMap private _claimed;
    mapping(address => Commit) private _commitments;

    constructor(
        address[] memory _contributors
    )
        ERC721("MerkleAirdrop", "MA")
        Ownable(msg.sender)
        Contributors(_contributors)
    {
        currentState = State.Presale;
    }

    function updateMerkleRoot(bytes32 _whitelistMerkleRoot) public onlyOwner {
        whitelistMerkleRoot = _whitelistMerkleRoot;
    }

    function hashPreimage(bytes32 _preimage) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_preimage));
    }

    modifier hasntClaimedBefore() {
        require(!_claimed.get(uint160(msg.sender)), "Already Claimed");
        _;
    }

    modifier isWhitelisted(bytes32[] calldata merkleProof) {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(merkleProof, whitelistMerkleRoot, leaf),
            "Invalid proof"
        );
        _;
    }

    modifier onlyPublicSale() {
        require(currentState == State.PublicSale, "Not in public sale state");
        _;
    }

    modifier saleHasNotEnded() {
        require(currentState != State.SoldOut, "Sale ended");
        _;
    }

    function startPublicSale() external onlyOwner {
        require(currentState == State.Presale, "Cannot start public sale");
        currentState = State.PublicSale;
    }

    function endSale() external onlyOwner saleHasNotEnded {
        currentState = State.SoldOut;
    }

    function commit(bytes32 commitment) external saleHasNotEnded {
        require(!_commitments[msg.sender].revealed, "Already revealed");
        uint64 blockNumber = uint64(block.number);
        _commitments[msg.sender].commitment = commitment;
        _commitments[msg.sender].blockNumber = blockNumber;

        emit HashCommitted(msg.sender, commitment, blockNumber);
    }

    function claim(
        bytes32[] calldata merkleProof
    )
        external
        payable
        nonReentrant
        onlyPublicSale
        saleHasNotEnded
        hasntClaimedBefore
        isWhitelisted(merkleProof)
    {
        require(msg.value >= 1 ether, "Insufficient funds");
        Commit storage commitment = _commitments[msg.sender];
        require(commitment.blockNumber > 0, "No commitment found");
        require(
            block.number > commitment.blockNumber + BLOCKS_BEFORE_REVEAL,
            "Wait for 10 blocks before revealing"
        );
        require(!commitment.revealed, "Already revealed");

        _claimed.set(uint160(msg.sender));
        _commitments[msg.sender].revealed = true;

        uint256 randomTokenId = uint256(
            keccak256(
                abi.encodePacked(
                    commitment.commitment,
                    blockhash(block.number - 1)
                )
            )
        );

        emit NFTClaimed(msg.sender, randomTokenId);

        _mint(msg.sender, randomTokenId);
    }

    function withdraw() external onlyOwner {
        _withdrawToContributors();
    }
}
