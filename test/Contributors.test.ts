import type { ContributorsExposed } from '../typechain-types';

import { expect } from 'chai';
import { setBalance, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { parseEther } from 'ethers';
import { ethers } from 'hardhat';


const generateRandomAddresses = (length = 5) => {
  const addresses = [];
  for (let i = 0; i < length; i++) {
    const wallet = ethers.Wallet.createRandom();
    addresses.push(wallet.address);
  }
  return addresses;
}

const _deploy = async (failingIndex?: number) => {
  const contributorsFactory = await ethers.getContractFactory("ContributorsExposed");
  const contributors = generateRandomAddresses();

  if (failingIndex !== undefined) {
    const failFactory = await ethers.getContractFactory("FailingContributor");
    const failingContributor = await failFactory.deploy();
    await failingContributor.waitForDeployment();
    contributors.splice(failingIndex, 1, await failingContributor.getAddress());
  }

  const contributorContract = (await contributorsFactory.deploy(
    contributors,
  )) as ContributorsExposed;
  await contributorContract.waitForDeployment();

  const getBalances = async () => ({
    contract: await ethers.provider.getBalance(await contributorContract.getAddress()),
    contributors: await Promise.all(contributors.map((a) => ethers.provider.getBalance(a))),
  })

  return {
    contributorContract,
    contributors,
    getBalances,
  };
}

describe('Contributors', () => {
  function deploy() {
    return _deploy();
  }
  it('should split balance to all', async () => {
    const { contributorContract, getBalances } = await loadFixture(deploy);
    
    setBalance(await contributorContract.getAddress(), parseEther('1'));
    await contributorContract.withdrawToContributors();
    let balances = await getBalances();
    expect(balances.contract).to.equal(parseEther('0'));
    expect(balances.contributors).to.have.members([
      parseEther('0.2'),
      parseEther('0.2'),
      parseEther('0.2'),
      parseEther('0.2'),
      parseEther('0.2')
    ]);
  });

  function firstFailing() {
    return _deploy(1);
  }

  it('should split balance to all if first fails', async () => {
    const { getBalances, contributorContract } = await loadFixture(firstFailing);
    const contractAddress = await contributorContract.getAddress();
    setBalance(contractAddress, parseEther('1'));
    await contributorContract.withdrawToContributors();
    let balances = await getBalances();
    expect(balances.contract).to.equal(parseEther('0.2'));
    expect(balances.contributors).to.have.members([
      parseEther('0'), // This one was substituted by the failing contract
      parseEther('0.2'),
      parseEther('0.2'),
      parseEther('0.2'),
      parseEther('0.2')
    ]);
    await contributorContract.withdrawToContributors();
    balances = await getBalances();
    expect(balances.contributors).to.have.members([
      parseEther('0'), 
      parseEther('0.25'),
      parseEther('0.25'),
      parseEther('0.25'),
      parseEther('0.25')
    ], "The rest of the address should have gotten the remaining balance");
  });

  function middleFailing() {
    return _deploy(2);
  }
  
  it('should split balance to all if last fails', async () => {
    const { getBalances, contributorContract } = await loadFixture(lastFailing);
    const contractAddress = await contributorContract.getAddress();
    setBalance(contractAddress, parseEther('1'));
    await contributorContract.withdrawToContributors();
    let balances = await getBalances();
    expect(balances.contract).to.equal(parseEther('0.2'));
    expect(balances.contributors).to.have.members([
      parseEther('0.2'), 
      parseEther('0.2'),
      parseEther('0.2'),
      parseEther('0.2'),
      parseEther('0') // This one was substituted by the failing contract
    ]);
    await contributorContract.withdrawToContributors();
    balances = await getBalances();
    expect(balances.contributors).to.have.members([
      parseEther('0.25'), 
      parseEther('0.25'),
      parseEther('0.25'),
      parseEther('0.25'),
      parseEther('0')
    ], "The rest of the address should have gotten the remaining balance");
  });

  function lastFailing() {
    return _deploy(4);
  }

  it('should split balance to if index 2 fails', async () => {
    const { getBalances, contributorContract } = await loadFixture(middleFailing);
    const contractAddress = await contributorContract.getAddress();
    setBalance(contractAddress, parseEther('1'));
    await contributorContract.withdrawToContributors();
    let balances = await getBalances();
    expect(balances.contract).to.equal(parseEther('0.2'));
    expect(balances.contributors).to.have.members([
      parseEther('0.2'), 
      parseEther('0.2'),
      parseEther('0'), // This one was substituted by the failing contract
      parseEther('0.2'),
      parseEther('0.2') 
    ]);
    await contributorContract.withdrawToContributors();
    balances = await getBalances();
    expect(balances.contributors).to.have.members([
      parseEther('0.25'), 
      parseEther('0.25'),
      parseEther('0'),
      parseEther('0.25'),
      parseEther('0.25')
    ], "The rest of the address should have gotten the remaining balance");
  });
});
