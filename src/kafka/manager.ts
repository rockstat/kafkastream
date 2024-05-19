import { Deps } from "@app/AppServer";
import { Logger, Meter } from "@rockstat/rock-me-ts";
import { KafkaConfig, HandyRecord } from "@app/types";
import { isObject } from '@app/helpers/object';
import { Kafka, Producer } from "kafkajs";

/**
 * Main writer class. Runs other nessesary components
 */
export class KafkaManager {
  formatter: (table: string, record: { [k: string]: any; }) => any;
  log: Logger;
  meter: Meter;
  options: KafkaConfig;
  initialized: boolean = false;
  copyProps: string[];
  kafka: Kafka;
  producer: Producer;
  /**
   *
   * @param deps DI
   */
  constructor(deps: Deps) {
    const { log, meter, config } = deps;
    this.log = log.for(this)
    this.meter = meter;
    this.options = config.get('kafkastream')
  }

  /**
   * Prepare database structure and
   * init dependend componenets
   */
  async init() {
    if (this.initialized) {
      throw new Error('Already initialized');
    }

    this.kafka = new Kafka({
      clientId: this.options.clientId,
      brokers: this.options.brokers
    })
    this.producer = this.kafka.producer();
    await this.producer.connect();

    // await this.chc.init();
    this.initialized = true;
    this.log.info('started');
  }

  /**
   * Write data to Kafka
   * @param msg BaseIncomingMessage
   */
  write = async (msg: HandyRecord) => {
    this.meter.tick('ch.write.called')
    const { time, ...rest } = msg;
    // const unix = Math.round(time / 1000);

    if ('service' in rest && 'name' in rest) {
      const nameKey = msg.name.toLowerCase().replace(/\s/g, '_');
      if ('data' in rest && isObject(rest.data)) {
        const data = rest.data;
        try {
          // data.date = dateFormat('%F', unix);
          const dt = (new Date(time)).toISOString().substring(0,19).replace('T', ' ');
          data.date = dt.substring(0, 10);
          // data.dateTime = dateFormat('%F %X', unix);
          data.dateTime = dt;
          data.timestamp = time;

          await this.producer.send({
            topic: 'rstat.web',
            
            messages: [
              { key: rest.uid, value: JSON.stringify(rest) },
            ],
          })
          
          this.meter.tick('ch.kafkastream.success');
        } catch (error) {
          console.error(`writer strange error`, error);
        }
      } else {
        this.log.warn('no data');
        console.log(isObject(rest.data), 'data' in rest)
      }
    }
    return {};
  }
}
