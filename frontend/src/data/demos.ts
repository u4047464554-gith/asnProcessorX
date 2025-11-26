export type DemoEntry = unknown
export type DemoMap = Record<string, Record<string, DemoEntry>>
export type DemoErrorMap = Record<string, Record<string, DemoEntry[]>>

export const demoPayloads: DemoMap = {
  simple_demo: {
    Person: {
      name: 'Alice',
      age: 30,
      isAlive: true,
    },
    Direction: {
      '$choice': 'uplink',
      value: {
        name: 'Bob',
        age: 25,
        isAlive: true,
      },
    },
    MyMessage: {
      id: 7,
      value: 'Hello World',
    },
    StatusCode: 42,
  },
  rrc_demo: {
    RRCConnectionRequest: {
      'ue-Identity': {
        '$choice': 'randomValue',
        value: ['0x0123456789', 40],
      },
      establishmentCause: 'mo-Signalling',
      spare: ['0x80', 1],
    },
    'InitialUE-Identity': {
      '$choice': 'randomValue',
      value: ['0x1122334455', 40],
    },
    'S-TMSI': {
      mmec: ['0xAA', 8],
      'm-TMSI': ['0x01020304', 32],
    },
  },
  multi_file_demo: {
    SessionStart: {
      subscriber: {
        mcc: 246,
        mnc: 1,
        msin: '0x48454c4c4f',
      },
      requested: 'serviceRequest',
      payload: '0x4578616d706c652073657373696f6e207061796c6f6164',
    },
    SubscriberId: {
      mcc: 310,
      mnc: 260,
      msin: '0x0102030405',
    },
    MessageId: 'attachRequest',
  },
}

export const demoErrorPayloads: DemoErrorMap = {
  simple_demo: {
    Person: [
      { name: '', age: 999, isAlive: true },
      { name: 'A', age: -5, isAlive: true },
    ],
    Direction: [
      { '$choice': 'invalidChoice', value: {} },
    ],
  },
  rrc_demo: {
    RRCConnectionRequest: [
      {
        'ue-Identity': {
          '$choice': 'randomValue',
          value: ['0x01', 8],
        },
        establishmentCause: 'invalidCause',
        spare: ['0x00', 0],
      },
    ],
  },
  multi_file_demo: {
    SessionStart: [
      {
        subscriber: {
          mcc: 50,
          mnc: 9999,
          msin: '0x01',
        },
        requested: 'invalidRequest',
        payload: '',
      },
    ],
  },
}

