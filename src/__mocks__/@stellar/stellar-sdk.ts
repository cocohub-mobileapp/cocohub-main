const actual = jest.requireActual('@stellar/stellar-sdk');

export const Keypair = {
  ...actual.Keypair,
  random: jest.fn((...args: any[]) => (actual.Keypair.random as any)(...args)),
  fromSecret: jest.fn((...args: any[]) => (actual.Keypair.fromSecret as any)(...args)),
};

export const Networks = actual.Networks;
export const Asset = actual.Asset;
export const Operation = actual.Operation;
export const TransactionBuilder = actual.TransactionBuilder;
export const BASE_FEE = actual.BASE_FEE;
export const Memo = actual.Memo;
export const StrKey = actual.StrKey;
export const NotFoundError = actual.NotFoundError;
export const BadRequestError = actual.BadRequestError;
export const BadResponseError = actual.BadResponseError;

export const Horizon = {
  ...actual.Horizon,
  Server: jest.fn((...args: any[]) => new (actual.Horizon.Server as any)(...args)),
  HorizonApi: actual.Horizon.HorizonApi,
};

export default {
  ...actual,
  Keypair,
  Networks,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Memo,
  StrKey,
  NotFoundError,
  BadRequestError,
  BadResponseError,
  Horizon,
};
