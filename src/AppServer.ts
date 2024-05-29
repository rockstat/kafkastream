import 'reflect-metadata';
import {
  RPCAdapterRedis,
  RPCAgnostic,
  AgnosticRPCOptions,
  Meter,
  RedisFactory,
  TheIds,
  Logger,
  AppConfig,
  RPCAdapter,
  MeterFacade
} from '@rockstat/rock-me-ts';

import {
  ModuleConfig
} from '@app/types';
import {
  KafkaManager
} from '@app/kafka';

import {
  SERVICE_DIRECTOR,
  METHOD_IAMALIVE,
  BROADCAST
} from '@app/constants';

/**
 * Dependency container
 */
export class Deps {
  log: Logger;
  id: TheIds;
  config: AppConfig<ModuleConfig>;
  meter: Meter;
  rpc: RPCAgnostic;
  rpcAdaptor: RPCAdapter;
  redisFactory: RedisFactory;
  constructor(obj: { [k: string]: any } = {}) {
    Object.assign(this, obj);
  }
}

/**
 * Main application. Contains main logic
 */
export class AppServer {
  log: Logger;
  deps: Deps;
  name: string;
  rpcAdaptor: RPCAdapter;
  rpc: RPCAgnostic;
  appStarted: Date = new Date();
  kafkamanager: KafkaManager;
  meter: MeterFacade

  constructor() {

    const config = new AppConfig<ModuleConfig>();
    console.log(config);
    console.dir(config.config.kafkastream);
    const log = new Logger(config.log);
    const meter = new Meter(config.meter);
    this.meter = meter;
    this.name = config.rpc.name;
    this.deps = new Deps({
      id: new TheIds(),
      log,
      config,
      meter
    })
    try {
      this.log = log.for(this);
      this.log.info('Starting service');
      // setup Redis
      const redisFactory = this.deps.redisFactory = new RedisFactory({ log, meter, ...config.redis });
      // Setup RPC
      const channels = [config.rpc.name, BROADCAST]
      const rpcOptions: AgnosticRPCOptions = { channels, redisFactory, log, meter, ...config.rpc }
      this.rpcAdaptor = this.deps.rpcAdaptor = new RPCAdapterRedis(rpcOptions);
      this.rpc = this.deps.rpc = new RPCAgnostic(rpcOptions);
      this.rpc.setup(this.rpcAdaptor);
      this.kafkamanager = new KafkaManager(this.deps);
    } catch (exc) {
      this.log.error(exc);
      this.stop();
    }
    this.setup()
      .then((() => {
        this.log.info('Setup completed');
      }))
      .catch(exc => {
        this.log.error(exc);
        this.stop();
      });
  }

  /**
   * Required remote functuins
   */
  async setup() {
    await this.kafkamanager.init();
    this.rpc.register(BROADCAST, this.kafkamanager.write);
    const aliver = () => {
      this.meter.tick('band.kafkamanager.alive')
      // this.rpc.notify(SERVICE_DIRECTOR, METHOD_IAMALIVE, { name: this.name })
    };
    // setTimeout(aliver, 500);
    setInterval(aliver, 1 * 1000);
  }

  /**
   * Graceful stot
   */
  private stop() {
    this.log.info('Stopping...');
    process.exit(0)
  }

  /**
   * Sinals listening
   */
  private attachSignals() {
    // Handles normal process termination.
    process.on('exit', () => this.stop());
    // Handles `Ctrl+C`.
    process.on('SIGINT', () => this.stop());
    // Handles `kill pid`.
    process.on('SIGTERM', () => this.stop());
  }
}

export const appServer = new AppServer();
