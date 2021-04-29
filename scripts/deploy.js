const { toBN } = require('../test/util');

const minimumStake = '1000';
const unstakeTime = '0';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(
    `Deploying contracts to ${network.name} with account: ${deployer.address}`,
    deployer.address,
  );

  console.log('Account balance:', (await deployer.getBalance()).toString());

  const tokenContract = await ethers.getContractFactory('TPA');
  const Staking = await ethers.getContractFactory('TPAStaking');
  const tpaToken = await tokenContract.deploy();
  const tpaStaking = await Staking.deploy(
    tpaToken.address, unstakeTime, minimumStake,
  );

  console.log('Token address:', tpaToken.address);
  console.log('Staking address:', tpaStaking.address);

  if(network.chainId === 3 || network.chainId === 1337) {
    // Transfer some ETH if we're on the local network
    if(network.chainId === 1337) {
      await deployer.sendTransaction({
        to: '0x15581c92DB672cC9316846aEF34DC46Ac95378c2',
        value: ethers.utils.parseEther('1.0'),
      });
    }
    const faucetContract = await ethers.getContractFactory('TPAFaucet');
    const faucet = await faucetContract.deploy(tpaToken.address, toBN('100000e18'));
    await tpaToken.transfer(faucet.address, toBN('1000000000e18'));
    console.log('Faucet address:', faucet.address);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
