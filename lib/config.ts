const os = require('os')
import Common from '@ethereumjs/common'
import { Logger } from 'winston'
import { defaultLogger } from './logging'
import { Libp2pServer, RlpxServer } from './net/server'

export interface Options {
  /**
   * Specify the chain and hardfork by passing a Common instance.
   *
   * Default: chain `mainnet` and hardfork `chainstart`
   */
  common?: Common
  /**
   * The logger instance with the log level set (winston)
   *
   * Default: Logger with loglevel 'debug'
   */
  logger?: Logger
  /**
   * Transport servers (RLPx or Libp2p)
   *
   * Default: []
   */
  servers?: (RlpxServer | Libp2pServer)[]
  /**
   * Synchronization mode ('fast' or 'light')
   *
   * Default: 'fast'
   */
  syncmode?: string
  /**
   * Serve light peer requests
   *
   * Default: false
   */
  lightserv?: boolean
  /**
   * Root data directory for the blockchain
   */
  datadir?: string
  /**
   * Number of peers needed before syncing
   *
   * Default: 2
   */
  minPeers?: number
  /**
   * Maximum peers allowed
   *
   * Default: 25
   */
  maxPeers?: number
}

export class Config {
  public common: Common
  public logger: Logger
  public servers: (RlpxServer | Libp2pServer)[]
  public syncmode: string
  public lightserv: boolean
  public datadir: string
  public minPeers: number
  public maxPeers: number

  public static readonly COMMON_DEFAULT = new Common({ chain: 'mainnet', hardfork: 'chainstart' })
  public static readonly LOGGER_DEFAULT = defaultLogger
  public static readonly SERVERS_DEFAULT = []
  public static readonly SYNCMODE_DEFAULT = 'fast'
  public static readonly LIGHTSERV_DEFAULT = false
  public static readonly DATADIR_DEFAULT = `${os.homedir()}/Library/Ethereum`
  public static readonly MINPEERS_DEFAULT = 2
  public static readonly MAXPEERS_DEFAULT = 25

  constructor(options: Options = {}) {
    // Initialize Common with an explicit 'chainstart' HF set until
    // hardfork awareness is implemented within the library
    // Also a fix for https://github.com/ethereumjs/ethereumjs-vm/issues/757

    // TODO: map chainParams (and lib/util.parseParams) to new Common format
    this.common = options.common ?? Config.COMMON_DEFAULT
    this.logger = options.logger ?? Config.LOGGER_DEFAULT
    this.servers = options.servers ?? Config.SERVERS_DEFAULT
    this.syncmode = options.syncmode ?? Config.SYNCMODE_DEFAULT
    this.lightserv = options.lightserv ?? Config.LIGHTSERV_DEFAULT
    this.datadir = options.datadir ?? Config.DATADIR_DEFAULT
    this.minPeers = options.minPeers ?? Config.MINPEERS_DEFAULT
    this.maxPeers = options.maxPeers ?? Config.MAXPEERS_DEFAULT
  }

  /**
   * Returns the directory for storing the client sync data
   * based on syncmode and selected chain (subdirectory of 'datadir')
   */
  getSyncDataDirectory(): string {
    const syncDirName = this.syncmode === 'light' ? 'lightchaindata' : 'chaindata'
    const chain = this.common.chainName()
    const networkDirName = chain === 'mainnet' ? '' : `${chain}/`

    const dataDir = `${this.datadir}/${networkDirName}ethereumjs/${syncDirName}`
    return dataDir
  }
}
