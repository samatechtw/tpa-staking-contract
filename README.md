# TPA Holdings Staking Contract

## Install

Install development environment
```
npm install
```

## Hardhat

[Hardhat](https://hardhat.org/) is used for development and contract deployment.

Compile contracts
```
npm run compile
```

Run local Eth node for development
```
npm run dev
```

Deploy contracts to local node
```
npm run deploy:dev
```

## Environment Variables

* **UNSTAKE_PERIOD** - Period in which tokens are locked after un-staking
* **ROPSTEN_RPC_URL** - Full URL of Ropsten RPC provider
* **MAINNET_RPC_URL** - Full URL of Mainnet RPC provider
* **ROPSTEN_WALLET_KEY** - Private key for Ropsten deploy and management
* **MAINNET_WALLET_KEY** - Private key for Mainnet deploy and management
* **EVM_LOGGING** - Hardhat logging flag
* **TEST_REPORT_GAS** - Report gas usage for contract deploys and method calls in tests


## Testing

Javascript (Mocha) tests
```
npm run test
```

Solidity code coverage
```
npm run test:coverage
```

## Linting

Javascript linting
```
npm run lint
```

Solidity linting
```
npm run lint:solidity
```

# Contracts

## TPAStaking

The main contract in this repository. TPAStaking contains functionality for staking TPA tokens (by users), submitting loan interest (by TPA
Holdings), calculating and receiving interest, and various convenience functions. The contracts power the [TPA Staking
Dashboard](https://github.com/samatechtw/tpa-dashboard).

## TPAToken

This is a replica of the existing TPA Token deployed to the mainnet at `0x68a1c939066f5bf90e1ba52a2ae47d17f47fd6f0`. It is used only for
testing and should NOT be re-deployed on the mainnet.

## TPAFaucet

This is a basic faucet contract for testing TPA token and staking functionality. It will not be deployed on the mainnet.
