// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IBadgeRenderer, IRender} from "./render/IRender.sol";

interface ITrackNames {
    function nameOf(uint256 id) external view returns (string memory);
}

/// @title DuckWek title badge (v2). Soulbound (ERC-5192): free, only won, never bought or sold.
/// @notice `minter` (the Race) is set once, so the owner can never mint a title. The picture is drawn by the renderer from
///         the title's own traits (rank, race, track, winner).
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
    address public minter; // DuckWekRace, set once
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

    constructor(address owner_, address tracks_) ERC721("DuckWek Title", "WEKTITLE") Ownable(owner_) {
        tracks = ITrackNames(tracks_);
    }

    function setMinter(address minter_) external onlyOwner {
        if (minter != address(0)) revert MinterAlreadySet();
        minter = minter_;
        emit MinterSet(minter_);
    }

    function setRenderer(address r) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();
        renderer = IBadgeRenderer(r);
        emit RendererSet(r);
    }

    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLockedSet();
    }

    function award(address to, bytes32 roomKey, uint64 raceId, uint16 rank, uint64 trackId, string calldata title)
        external
        returns (uint256 id)
    {
        if (msg.sender != minter) revert NotMinter();
        id = nextId++;
        titles[id] = Title(roomKey, raceId, rank, trackId, title);
        _mint(to, id);
        emit Locked(id);
    }

    function locked(uint256 id) external view returns (bool) {
        _requireOwned(id);
        return true;
    }

    function _update(address to, uint256 id, address auth) internal override returns (address) {
        address from = _ownerOf(id);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, id, auth);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        address winner = _requireOwned(id);
        if (address(renderer) == address(0)) revert NoRenderer();
        Title memory t = titles[id];
        return renderer.badgeURI(id, IRender.TitleView(t.title, t.raceId, t.rank, tracks.nameOf(t.trackId), winner));
    }

    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0xb45a3c0e || super.supportsInterface(id);
    }
}
