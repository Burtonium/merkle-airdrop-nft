# Merkle Airdrop

This Solidity smart contract implements a Merkle airdrop mechanism for distributing ERC721 tokens. It allows for a presale phase, a public sale phase, and ending the sale. Users can commit to the sale, claim their NFTs based on a Merkle proof, and withdraw funds.

Features:

- Presale and Public Sale Phases: Transition between presale and public sale phases controlled by the contract owner.
- Merkle Airdrop: Users can claim NFTs based on a Merkle proof of their address.
- Sale Management: Start and end the sale phases, ensuring controlled distribution.
- Contributor Withdrawal: Contract owner can withdraw funds to contributors.

## Dependencies

- OpenZeppelin Contracts: Utilizes ERC721, Ownable, Multicall, ReentrancyGuard, and other utility contracts from OpenZeppelin.
- Contributors: External contributors can be specified during contract deployment.

## Usage

- Start Public Sale: The owner can start the public sale phase using startPublicSale() function.
- Commit: Users can commit to the sale using commit() function, providing a commitment hash.
- Claim: Users can claim their NFTs by providing a valid Merkle proof and sending sufficient funds.
- End Sale: The owner can end the sale phase using endSale() function.
- Withdraw: The owner can withdraw funds to contributors using withdraw() function.

## Disclaimer

This contract is provided as-is, without any warranties or guarantees. Users should review and understand the code before interacting with the contract.

## License

This software is released under the MIT License. See LICENSE for more details.
