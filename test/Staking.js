const assert = require('assert');
const {
  toBN,
  assertBalance,
  assertStake,
  assertUnstake,
  assertWithdraw,
  assertReinvest,
  shouldRevert,
  assertBN,
  postDividend,
} = require('./util');

describe('Token contract', () => {
  const minimumStake = toBN(1000);
  const unstakeTime = toBN(0);
  let Staking;
  let tpaStaking;
  let tpaToken;
  let owner;
  let u1;
  let u2;
  let u3;
  let u4;

  before(async () => {
    const tokenContract = await ethers.getContractFactory('TPA');
    Staking = await ethers.getContractFactory('TPAStaking');
    [owner, u1, u2, u3, u4] = await ethers.getSigners();

    tpaToken = await tokenContract.deploy();
    await tpaToken.deployed();
  });

  beforeEach(async () => {
    tpaStaking = await Staking.deploy(
      tpaToken.address, unstakeTime, minimumStake,
    );
  });

  it('Should set the owner and send tokens', async () => {
    assert.strictEqual(await tpaStaking.owner(), owner.address);

    // 10M tokens
    const initialTokens = toBN('10000000e18');

    await tpaToken.transfer(u1.address, initialTokens);
    await tpaToken.transfer(u2.address, initialTokens);
    await tpaToken.transfer(u3.address, initialTokens);
    await tpaToken.transfer(u4.address, initialTokens);

    await assertBalance(tpaToken, u1.address, initialTokens);
    await assertBalance(tpaToken, u2.address, initialTokens);
    await assertBalance(tpaToken, u3.address, initialTokens);
    await assertBalance(tpaToken, u4.address, initialTokens);
  });

  it('Check staking error conditions', async () => {
    // 1M tokens
    const stake = toBN('1000000e18');

    // Stake without approval
    await shouldRevert(tpaStaking.stake(stake), 'Allowance low');

    // Stake below minimum
    const low = minimumStake - toBN(1);
    await tpaToken.approve(tpaStaking.address, low);
    await shouldRevert(tpaStaking.stake(low), 'Stake too low');
  });

  it('Should unstake correctly without rewards', async () => {
    // 1M tokens
    const stake = toBN('1000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u1, u2, u3],
      stake,
    });

    await assertUnstake({ tpaToken, tpaStaking, signer: u1, expectedTpa: stake });
    await assertUnstake({ tpaToken, tpaStaking, signer: u2, expectedTpa: stake });
    await assertUnstake({ tpaToken, tpaStaking, signer: u3, expectedTpa: stake });
  });

  it('Should unstake correctly with rewards', async () => {
    // 1M tokens
    const stake = toBN('1000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u1, u2, u3],
      stake,
    });

    await postDividend(tpaToken, tpaStaking, stake);

    // First and second unstaker should get 1/3 of 4M
    let expectedTpa = (stake * toBN('4')) / toBN('3');
    await assertUnstake({ tpaToken, tpaStaking, signer: u1, expectedTpa });
    await assertUnstake({ tpaToken, tpaStaking, signer: u2, expectedTpa });

    await postDividend(tpaToken, tpaStaking, stake);

    // Last staker should get remainder of pool
    expectedTpa = await tpaToken.balanceOf(tpaStaking.address);
    await assertUnstake({ tpaToken, tpaStaking, signer: u3, expectedTpa });

    assertBalance(tpaToken, tpaStaking.address, 0);
    const stakedTPA = await tpaStaking.stakedTPA();
    const totalPool = await tpaToken.balanceOf(tpaStaking.address);

    assertBN(stakedTPA, toBN(0), 'Staked TPA not 0');
    assertBN(totalPool, toBN(0), 'Total pool not 0');
  });

  it('Handles dividend edge cases', async () => {
    // Can't post dividends if there are no stakers
    const stake = toBN('1000000e18');
    await tpaToken.approve(tpaStaking.address, stake);
    await shouldRevert(tpaStaking.postDividend(stake), 'No stakers');

    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u1],
      stake,
    });

    // Two dividends without new stakers in between are merged
    await tpaStaking.postDividend(stake);
    await postDividend(tpaToken, tpaStaking, stake);
    let count = toBN(await tpaStaking.getDividendCount());
    assertBN(count, 1);

    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u2],
      stake,
    });
    await postDividend(tpaToken, tpaStaking, stake);
    // Dividend should not be merged
    count = toBN(await tpaStaking.getDividendCount());
    assertBN(count, 2);

    // u2 gets half of second dividend
    let expectedTpa = stake + (stake / toBN(2));
    await assertUnstake({ tpaToken, tpaStaking, signer: u2, expectedTpa });
    // u1 gets remainder of second dividend plus first 2 dividends
    expectedTpa = stake + (stake * toBN(2)) + (stake / toBN(2));
    await assertUnstake({ tpaToken, tpaStaking, signer: u1, expectedTpa });
  });

  it('Can reinvest and withdraw dividends', async () => {
    const stake = toBN('1000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u1, u2],
      stake,
    });

    const div1 = toBN('2000000e18');
    await postDividend(tpaToken, tpaStaking, div1);

    // u1 withdraws
    let expectedTpa = div1 / toBN('2');
    await assertWithdraw({ tpaToken, tpaStaking, signer: u1, expectedTpa });
    // u2 reinvests
    const expectedStake = stake + div1 / toBN('2');
    await assertReinvest({ tpaStaking, signer: u2, expectedStake });

    // Another user stakes
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u3],
      stake,
    });

    const div2 = toBN('4000000e18');
    await postDividend(tpaToken, tpaStaking, div2);

    // Stakes: u1=1M, u2=2M, u3=1M
    expectedTpa = stake + div2 / toBN('4');
    await assertUnstake({ tpaToken, tpaStaking, signer: u1, expectedTpa });
    await assertUnstake({ tpaToken, tpaStaking, signer: u3, expectedTpa });
    expectedTpa = stake * toBN('2') + div2 / toBN('2');
    await assertUnstake({ tpaToken, tpaStaking, signer: u2, expectedTpa });
  });

  it('Works with complex staking/rewards', async () => {
    const stake1 = toBN('1000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u1],
      stake: stake1,
    });
    const stake2 = toBN('2000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u2],
      stake: stake2,
    });
    // Pool = 3M, Div1 = 2M
    const div1 = toBN('2000000e18');
    await postDividend(tpaToken, tpaStaking, div1);

    const stake3 = toBN('4000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u3],
      stake: stake3,
    });

    // Should receive original stake with no reward
    await assertUnstake({ tpaToken, tpaStaking, signer: u3, expectedTpa: stake3 });

    // Stake twice
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u3],
      stake: stake3,
    });
    const stake4 = toBN('4000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u3],
      stake: stake4,
    });

    // Receive first and second stake with no reward
    await assertUnstake({ tpaToken, tpaStaking, signer: u3, expectedTpa: stake3 + stake4 });

    const stake5 = toBN('7000000e18');
    await assertStake({
      tpaToken,
      tpaStaking,
      signers: [u3],
      stake: stake5,
    });

    // Pool = 10M, Div1 = 2M(3M stake), Div2 = 10M(10M stake)
    const div2 = toBN('10000000e18');
    await postDividend(tpaToken, tpaStaking, div2);

    let expectedTpa = stake1 + (stake1 * div1) / toBN('3e24') + (stake1 * div2) / toBN('10e24');
    await assertUnstake({ tpaToken, tpaStaking, signer: u1, expectedTpa });
    // Add one for rounding since u2 gets the remainder of the first pool
    expectedTpa = toBN(1) + stake2 + (stake2 * div1) / toBN('3e24') + (stake2 * div2) / toBN('10e24');
    await assertUnstake({ tpaToken, tpaStaking, signer: u2, expectedTpa });
    expectedTpa = stake5 + (stake5 * div2) / toBN('10e24');
    await assertUnstake({ tpaToken, tpaStaking, signer: u3, expectedTpa });
  });
});
