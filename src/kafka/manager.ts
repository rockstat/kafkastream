import { Deps } from "@app/AppServer";
import { Logger, Meter } from "@rockstat/rock-me-ts";
import { KafkaConfig, HandyRecord } from "@app/types";
import { isObject } from '@app/helpers/object';
import { Kafka, Producer, CompressionTypes } from "kafkajs";
import * as getValue from 'get-value';

/**
 * 
 * 
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
  writers: { [k: string]: any[] } = {};
  map: Map<string, [string, string]> = new Map();
  /**
   *
   * @param deps DI
   */
  constructor(deps: Deps) {
    const { log, meter, config } = deps;
    this.log = log.for(this)
    this.meter = meter;
    this.options = config.get('kafkastream');

    for (let [k, v] of Object.entries(this.options.mapping)) {
      this.map.set(k, v);
    }

    // const topicMessages = [
    //   {
    //     topic: 'topic-a',
    //     messages: [{ key: 'key', value: 'hello topic-a' }],
    //   },
    //   {
    //     topic: 'topic-b',
    //     messages: [{ key: 'key', value: 'hello topic-b' }],
    //   },
    //   {
    //     topic: 'topic-c',
    //     messages: [
    //       {
    //         key: 'key',
    //         value: 'hello topic-c',
    //         headers: {
    //           'correlation-id': '2bfb68bb-893a-423b-a7fa-7b568cad5b67',
    //         },
    //       }
    //     ],
    //   }
    // ]
    // await producer.sendBatch({ topicMessages })

    // setInterval(() => {
    //   for (let [k, v] of Object.entries(this.writers)) {
    //     if (v.length > 0) {
    //       const items = v;
    //       this.writers[k] = []            
    //     }
    //   }
    // }, 500);
  }

  // getWriter(name: string) {
  //   if (!this.writers[name]) {
  //     this.writers[name] = [];
  //   }
  //   return this.writers[name];
  // }

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
    const { time, key, ...rest } = msg;
    // const unix = Math.round(time / 1000);

    if (key && 'service' in rest && 'name' in rest) {

      let topic, kafkaKey;

      for (const [k, v] of this.map) {
        if (key.startsWith(k)) {
          [topic, kafkaKey] = v;
        }
      }

      if (topic && kafkaKey && ('data' in rest) && isObject(rest.data)) {

        const kafkaKeyValue = getValue(rest, kafkaKey);
        
        // this.log.info({ kafkaKeyValue, kafkaKey, topic, rest: rest.data }, 'pre msg')

        if (!kafkaKeyValue) {
          this.log.warn('no kafkaKeyValue');
          return {};
        }
        
        const data = rest.data;
        try {
          // data.date = dateFormat('%F', unix);
          const dt = (new Date(time)).toISOString().substring(0, 19).replace('T', ' ');
          data.date = dt.substring(0, 10);
          // data.dateTime = dateFormat('%F %X', unix);
          data.dateTime = dt;
          data.timestamp = time;

          // this.getWriter(msg.key).push({ key: rest.uid, value: JSON.stringify(rest) })
          const msgData = JSON.stringify(rest);

          await this.producer.send({
            topic: topic,

            messages: [
              { key: kafkaKeyValue, value: msgData },
            ],
          })
          this.log.info({ kafkaKeyValue, topic, msgData }, 'msg')

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
