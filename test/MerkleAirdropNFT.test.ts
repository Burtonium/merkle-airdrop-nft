import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import '@nomicfoundation/hardhat-chai-matchers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { randomBytes } from 'crypto';
import { parseEther } from 'ethers';


// proof for 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
const proof = [
  "0xf6d82c545c22b72034803633d3dda2b28e89fb704f3c111355ac43e10612aedc",
  "0x198bf4b157028bd818b30ce2f1b1a63feceee122e59515edfa7dd53906d1f5ad",
  "0x9a1f526d725e5e1dda21ae0f2539a3fe6b35b83613587f79cca45bd0a2b9ac07"
];

function getRandomBytesHex(size = 32): string {
  const randomBytesBuffer = randomBytes(size);
  return `0x${randomBytesBuffer.toString('hex')}`;
}

const deploy = async () => {
  const merkleAirdropFactory = await ethers.getContractFactory("MerkleAirdrop");
  const signers = (await ethers.getSigners()).slice(0, 5);
  const contributors = signers.map((s) => s.address);
  const merkleAirdrop = (await merkleAirdropFactory.deploy(contributors));
  
  merkleAirdrop.waitForDeployment();

  return {
    merkleAirdrop,
    signers
  };
}

enum State {
  PRIVATE_SALE = 0,
  PUBLIC_SALE,  
  ENDED
}

describe('MerkleAirdrop', () => {
  it('Happy path state changes should work state', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    expect(await merkleAirdrop.currentState()).to.equal(State.PRIVATE_SALE);
    await merkleAirdrop.startPublicSale();
    expect(await merkleAirdrop.currentState()).to.equal(State.PUBLIC_SALE);
    await merkleAirdrop.endSale();
    expect(await merkleAirdrop.currentState()).to.equal(State.ENDED);
  });

  it('Premature sale ending should succeed', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    await merkleAirdrop.endSale();
    expect(await merkleAirdrop.currentState()).to.equal(State.ENDED);
  });

  it('Ended state works correctly', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    await merkleAirdrop.endSale();
    expect(await merkleAirdrop.currentState()).to.equal(State.ENDED);
    await expect(merkleAirdrop.startPublicSale()).to.be.reverted;
    await expect(merkleAirdrop.endSale()).to.be.reverted;
    const commitment = await merkleAirdrop.hashPreimage(getRandomBytesHex());
    await expect(merkleAirdrop.commit(commitment)).to.be.reverted;
  });

  it('Commiting should work in presale and sale I guess?', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    let commitment = await merkleAirdrop.hashPreimage(getRandomBytesHex());
    await expect(merkleAirdrop.commit(commitment)).to.not.eventually.be.rejected;
    await merkleAirdrop.startPublicSale();
    await expect(merkleAirdrop.commit(commitment)).to.not.eventually.be.rejected;
  });


  it('Commiting should work in presale and sale I guess?', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    let commitment = await merkleAirdrop.hashPreimage(getRandomBytesHex());
    await expect(merkleAirdrop.commit(commitment)).to.not.eventually.be.rejected;
    await merkleAirdrop.startPublicSale();
    await expect(merkleAirdrop.commit(commitment)).to.not.eventually.be.rejected;
  });

  it('Claim should fail before 10 blocks', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    let commitment = await merkleAirdrop.hashPreimage(getRandomBytesHex());
    await merkleAirdrop.commit(commitment);
    await merkleAirdrop.startPublicSale();
    await expect(merkleAirdrop.claim(proof, { value: parseEther('1') })).to.be.revertedWith("Wait for 10 blocks before revealing");
  });

  it('Claim should fail lower than 1 ETH', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    let commitment = await merkleAirdrop.hashPreimage(getRandomBytesHex());
    await merkleAirdrop.commit(commitment);
    await merkleAirdrop.startPublicSale();
    await expect(merkleAirdrop.claim(proof, { value: parseEther('0.99') })).to.be.revertedWith("Insufficient funds");
  });

  it('Claim should fail without commitment', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    await merkleAirdrop.startPublicSale();
    await expect(merkleAirdrop.claim(proof, { value: parseEther('1') })).to.be.revertedWith("No commitment found");
  });

  it('Claim should fail with wrong proof', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    let commitment = await merkleAirdrop.hashPreimage(getRandomBytesHex());
    await merkleAirdrop.commit(commitment);
    await merkleAirdrop.startPublicSale();

    await expect(merkleAirdrop.claim(proof.slice().reverse(), { value: parseEther('1') })).to.be.revertedWith("Invalid proof");
  });

  it('Claim should work', async () => {
    const { merkleAirdrop } = await loadFixture(deploy);
    let commitment = await merkleAirdrop.hashPreimage(getRandomBytesHex());
    await merkleAirdrop.commit(commitment);
    await merkleAirdrop.startPublicSale();
    await network.provider.send("hardhat_mine", ["0x8"]);
    await expect(merkleAirdrop.claim(proof, { value: parseEther('1') })).to.be.revertedWith("Wait for 10 blocks before revealing");
    await network.provider.send("hardhat_mine");

    await expect(await merkleAirdrop.claim(proof, { value: parseEther('1') })).to.emit(merkleAirdrop, 'NFTClaimed');
  });
});
