// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IBadgeRenderer, IRender, ITrackNames} from "./render/IRender.sol";

contract Badge is ERC721, Ownable2Step {
    struct Title {
        bytes32 roomKey;
        uint64 raceId;
        uint16 rank;
        uint64 trackId;
        string title;
    }

    mapping(uint256 => Title) public titles;
    uint256 public nextId = 1;
    address public minter;
    ITrackNames public immutable tracks;
    IBadgeRenderer public renderer;
    bool public rendererLocked;

    event Locked(uint256 tokenId);
    event MinterSet(address minter);
    event RendererSet(address renderer);
    event RendererLockedSet();

    error Soulbound();
    error NotMinter();
    error MinterAlreadySet();
    error RendererIsLocked();
    error NoRenderer();
    error ZeroAddress();

    constructor(address owner_, address tracks_) ERC721("DuckWek Title", "WEKTITLE") Ownable(owner_) {
        tracks = ITrackNames(tracks_);
    }

    function setMinter(address minter_) external onlyOwner {
        if (minter_ == address(0)) revert ZeroAddress();

        if (minter != address(0)) revert MinterAlreadySet();

        minter = minter_;
        emit MinterSet(minter_);
    }

    function setRenderer(address renderer_) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();

        renderer = IBadgeRenderer(renderer_);
        emit RendererSet(renderer_);
    }

    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLockedSet();
    }

    function award(address to, bytes32 roomKey, uint64 raceId, uint16 rank, uint64 trackId, string calldata title)
        external
        returns (uint256 tokenId)
    {
        if (msg.sender != minter) revert NotMinter();

        tokenId = nextId++;
        titles[tokenId] = Title(roomKey, raceId, rank, trackId, title);
        _mint(to, tokenId);
        emit Locked(tokenId);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();

        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address winner = _requireOwned(tokenId);
        if (address(renderer) == address(0)) revert NoRenderer();

        Title memory earnedTitle = titles[tokenId];
        return renderer.badgeURI(
            tokenId,
            IRender.TitleView(
                earnedTitle.title, earnedTitle.raceId, earnedTitle.rank, tracks.nameOf(earnedTitle.trackId), winner
            )
        );
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }
}
