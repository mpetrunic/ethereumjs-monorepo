import {
  Account,
  Address,
  bigIntToBuffer,
  bufferToHex,
  setLengthLeft,
  toBuffer,
} from '@ethereumjs/util'
import { BaseProvider, StaticJsonRpcProvider } from '@ethersproject/providers'
import * as tape from 'tape'

import { EthersForkedStateProvider } from '../src/ethersForkedStateProvider'

import { MockProvider } from './testdata/providerData/mockProvider'

import type { EthersStateManager } from '../src/ethersStateManager'

// Hack to detect if running in browser or not
const isBrowser = new Function('try {return this===window;}catch(e){ return false;}')

// To run the tests with a live provider, set the PROVIDER environmental variable with a valid provider url
// from Infura/Alchemy or your favorite web3 provider when running the test.  Below is an example command:
// `PROVIDER=https://mainnet.infura.io/v3/[mySuperS3cretproviderKey] npm run tape -- 'test/ethersStateManager.spec.ts'
tape('Ethers State Manager initialization tests', (t) => {
  const provider = new MockProvider()
  const state = new EthersForkedStateProvider(provider)
  t.ok(
    state instanceof EthersForkedStateProvider,
    'should instantiate with JsonRpcProvider subclass'
  )
  t.equal(
    (state as any).ethersStateManager.blockTag,
    '0x1',
    'should instantiate with ethersStateManager'
  )

  const _state = new EthersForkedStateProvider('http://localhost:8545')
  t.ok(_state instanceof EthersForkedStateProvider, 'should instantiate with valid url')

  const invalidProvider = new BaseProvider('mainnet')
  try {
    new EthersForkedStateProvider(invalidProvider as any)
    t.fail('should not instantiate with invalid provider')
  } catch (err) {
    t.equal(
      (err as any).message.slice(0, 37),
      'valid JsonRpcProvider or url required',
      'should not instantiate with invalid provider'
    )
  }

  t.test('getCode', async (st) => {
    const address = new Address(Buffer.from('a94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'hex'))
    const code = Buffer.from(
      '73095e7baea6a6c7c4c2dfeb977efac326af552d873173095e7baea6a6c7c4c2dfeb977efac326af552d873157',
      'hex'
    )
    const raw = {
      nonce: '0x0',
      balance: '0x03e7',
      stateRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
      codeHash: '0xb30fb32201fe0486606ad451e1a61e2ae1748343cd3d411ed992ffcc0774edd4',
    }
    const account = Account.fromAccountData(raw)
    await ((state as any).ethersStateManager as EthersStateManager).putAccount(address, account)
    await ((state as any).ethersStateManager as EthersStateManager).putContractCode(address, code)
    const codeRetrieved = await state.getCode('0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b')
    st.deepEqual(codeRetrieved, bufferToHex(code))
    st.end()
  })
  t.end()
})

tape('getCode / getStorageAt', async (t) => {
  if (isBrowser() === true) {
    // The `MockProvider` is not able to load JSON files dynamically in browser so skipped in browser tests
    t.end()
  } else {
    const provider =
      process.env.PROVIDER !== undefined
        ? new StaticJsonRpcProvider(process.env.PROVIDER, 1)
        : new MockProvider()
    const state = new EthersForkedStateProvider(provider)
    const UNIerc20ContractAddress = Address.fromString('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')
    const UNIContractCode = await state.getCode('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')
    t.equal(UNIContractCode, '0x00', 'was able to retrieve UNI contract code')

    await ((state as any).ethersStateManager as EthersStateManager).putContractCode(
      UNIerc20ContractAddress,
      toBuffer(UNIContractCode)
    )

    const storageSlot = await state.getStorageAt(
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      setLengthLeft(bigIntToBuffer(1n), 32)
    )
    t.ok(storageSlot.length > 0, 'should to retrieve storage slot 1 for the UNI contract')

    await ((state as any).ethersStateManager as EthersStateManager).putContractStorage(
      UNIerc20ContractAddress,
      setLengthLeft(bigIntToBuffer(2n), 32),
      Buffer.from('abcd')
    )
    const slotValue = await state.getStorageAt(
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      setLengthLeft(bigIntToBuffer(2n), 32)
    )
    t.deepEqual(slotValue, bufferToHex(Buffer.from('abcd')), 'should retrieve slot 2 value')

    await ((state as any).ethersStateManager as EthersStateManager).putContractStorage(
      UNIerc20ContractAddress,
      setLengthLeft(bigIntToBuffer(2n), 32),
      Buffer.from([])
    )

    const deletedSlot = await state.getStorageAt(
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      setLengthLeft(bigIntToBuffer(2n), 32)
    )

    t.equal(deletedSlot, '0x', 'should return empty buffer for deleted slot')
    t.end()
  }
})

tape(`getTransactionCount / getBalance`, async (t) => {
  const provider =
    process.env.PROVIDER !== undefined
      ? new StaticJsonRpcProvider(process.env.PROVIDER, 1)
      : new MockProvider()
  const state = new EthersForkedStateProvider(provider)

  const address = Address.fromString('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')
  const account = await ((state as any).ethersStateManager as EthersStateManager).getAccount(
    address
  )
  const nonce = account.nonce
  const balance = account.balance
  await ((state as any).ethersStateManager as EthersStateManager).putAccount(address, account)

  const bal = await state.getBalance(address.toString())
  t.equal(bal.toBigInt(), balance, 'should return the correct balance')

  const count = await state.getTransactionCount(address.toString())
  t.equal(BigInt(count), nonce, 'should return the correct nonce')

  account.nonce = nonce + 1n
  account.balance = 999999n
  await ((state as any).ethersStateManager as EthersStateManager).putAccount(address, account)

  const _count = await state.getTransactionCount(address.toString())
  t.equal(BigInt(_count), nonce + 1n, 'should return the correct nonce')
  const _bal = await state.getBalance(address.toString())
  t.equal(_bal.toBigInt(), 999999n, 'should return the correct balance')
  t.end()
})
