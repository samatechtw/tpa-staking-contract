const assert = require('assert');

const parseSci = (value) => {
  const eInd = value.indexOf('e');
  if(eInd !== -1) {
    const vals = value.split('e');
    const exp = (vals[1].startsWith('+') ? vals[1].slice(1) : vals[1]) || '0';
    let val = vals[0];
    if(val.length === 0 || Number.isNaN(parseInt(val, 10))) {
      throw Error(`Cannot parse ${value}`);
    }
    const dotInd = val.indexOf('.');
    let addZeros = parseInt(exp, 10);
    val = val.replace('.', '');
    if(dotInd !== -1) {
      addZeros -= (val.length - dotInd);
      if(addZeros < 0) {
        return `${val.slice(0, addZeros)}.${val.slice(addZeros)}`;
      }
    }
    return `${val}${'0'.repeat(addZeros)}`;
  }
  return value;
};

const toSafeNumber = (value) => parseSci(value.toString());

const toBN = (num) => BigInt(toSafeNumber(num));

function assertBN(bn1, bn2, msg) {
  bn1 = toSafeNumber(bn1);
  bn2 = toSafeNumber(bn2);
  assert.strictEqual(bn1, bn2, `${msg}. ${bn1} !== ${bn2}`);
}

async function assertBalance(Token, address, amount) {
  const balance = await Token.balanceOf(address);
  assertBN(
    balance,
    toBN(amount),
    'Balance incorrect',
  );
}

async function assertGains(tpaStaking, address, expected) {
  const gains = await tpaStaking.unrealizedGains(address);
  assertBN(gains, expected, 'Shares do no match expected');
}

async function assertStake({ tpaToken, tpaStaking, signers, stake }) {
  const amountBN = toBN(stake);
  for(let i = 0; i < signers.length; i += 1) {
    const signer = signers[i];
    const originalStake = toBN(await tpaStaking.getStake(signer.address));

    await tpaToken.connect(signer).approve(tpaStaking.address, amountBN);
    await tpaStaking.connect(signer).stake(amountBN);
    const staked = await tpaStaking.getStake(signer.address);
    assertBN(staked, originalStake + stake, 'Stake does not match input');
    await assertGains(tpaStaking, signer.address, 0);
  }
}

async function assertUnstake({ tpaToken, tpaStaking, signer, expectedTpa }) {
  const initialTpa = toBN(await tpaToken.balanceOf(signer.address));
  await tpaStaking.connect(signer).unstake();
  await assertBalance(tpaToken, signer.address, initialTpa + toBN(expectedTpa));
}

async function assertWithdraw({ tpaToken, tpaStaking, signer, expectedTpa }) {
  const initialTpa = toBN(await tpaToken.balanceOf(signer.address));
  await tpaStaking.connect(signer).withdrawDividends();
  await assertBalance(tpaToken, signer.address, initialTpa + toBN(expectedTpa));
}

async function assertReinvest({ tpaStaking, signer, expectedStake }) {
  await tpaStaking.connect(signer).reinvest();
  const stake = toBN(await tpaStaking.getStake(signer.address));
  await assertBN(stake, expectedStake);
}

async function postDividend(tpaToken, tpaStaking, amount) {
  await tpaToken.approve(tpaStaking.address, amount);
  await tpaStaking.postDividend(amount);
}

const shouldRevert = async (action, expectedOutput, message) => {
  try {
    await action;
    assert.strictEqual(false, true, message);
  } catch(error) {
    assert.ok(
      error.message.includes(expectedOutput),
      `Expected: "${expectedOutput}" - (${message}`,
    );
  }
};

module.exports = {
  toBN,
  assertBN,
  assertBalance,
  assertStake,
  assertUnstake,
  assertWithdraw,
  assertReinvest,
  assertGains,
  postDividend,
  toSafeNumber,
  shouldRevert,
};
