
export type KafkaConfig = {
  clientId: string;
  brokers: Array<string>;
  mapping: { [k: string]: [string, string] }

};

export type HandyRecord = {
  [k: string]: any;
};

// ##### CONFIG ROOT #####
export type ModuleConfig = {
  name: string;
  kafkastream: KafkaConfig;
}


