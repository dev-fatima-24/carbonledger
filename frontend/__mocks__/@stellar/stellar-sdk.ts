export const Networks = {
  PUBLIC: "Public",
  TESTNET: "Testnet",
};

export const BASE_FEE = 100;

export class Keypair {
  constructor(private key: string) {}
  public static random() {
    return new Keypair("GTESTKEY");
  }
  public publicKey() {
    return this.key;
  }
  public secret() {
    return "STESTKEY";
  }
}

export const Horizon = {
  Server: class {
    constructor(public url: string) {}
    loadAccount = jest.fn();
    submitTransaction = jest.fn();
  },
};

export const SorobanRpc = {
  Api: {
    GetTransactionStatus: {
      SUCCESS: "SUCCESS",
      FAILED: "FAILED",
    },
  },
  Server: class {
    constructor(public url: string) {}
    getAccount = jest.fn();
    simulateTransaction = jest.fn();
    sendTransaction = jest.fn();
    getTransaction = jest.fn();
    getEvents = jest.fn();
  },
};

export class Asset {
  constructor(public code: string, public issuer: string) {}
}

export const Operation = {
  payment: ({ destination, asset, amount }: any) => ({ type: "payment", destination, asset, amount }),
  changeTrust: ({ asset }: any) => ({ type: "changeTrust", asset }),
};

export class TransactionBuilder {
  public operations: any[] = [];
  constructor(public account: any, public opts: any) {}
  addOperation(op: any) {
    this.operations.push(op);
    return this;
  }
  setTimeout(_timeout: number) {
    return this;
  }
  build() {
    return {
      sign: jest.fn(),
      operations: this.operations,
    };
  }
  static fromXDR(xdr: any, network: any) {
    return { xdr, network };
  }
}

export const xdr = {
  HostFunction: {
    hostFunctionTypeInvokeContract: (arg: any) => ({ type: "invokeHostFunction", arg }),
  },
  InvokeContractArgs: class {
    constructor(public value: any) {
      Object.assign(this, value);
    }
  },
  ScVal: class {},
};

export const scValToNative = jest.fn((scVal: any) => scVal);
export const nativeToScVal = jest.fn((value: any) => value);

export class Address {
  constructor(public id: string) {}
  toScAddress() {
    return { address: this.id };
  }
}
