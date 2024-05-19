
export type KafkaConfig = {
  clientId: string;
  brokers: Array<string>;
};

export type HandyRecord = {
  [k: string]: any;
};

// ##### CONFIG ROOT #####
export type ModuleConfig = {
  name: string;
  kafkastream: KafkaConfig;
}
