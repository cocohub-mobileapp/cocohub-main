import { Server, Keypair, TransactionBuilder, Operation } from 'stellar-sdk';

export const getBalances = async (server: Server, publicKey: string) => {
  try {
    const account = await server.loadAccount(publicKey);
    const balances = {};
    account.balances.forEach(balance => {
      if (balance.asset_code) {
        balances[balance.asset_code] = parseFloat(balance.balance);
      }
    });
    return balances;
  } catch (err) {
    throw new Error(`Failed to load account: ${err.message}`);
  }
};

export const addTrustline = async (server: Server, keypair: Keypair, assetCode: string, assetIssuer: string) => {
  try {
    const transaction = new TransactionBuilder(server, {
      fee: 100,
      networkPassphrase: server.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({
        asset: new Operation.Asset(assetCode, assetIssuer),
      }))
      .setTimeout(30)
     .build();

    transaction.sign(keypair);

    await server.submitTransaction(transaction);
  } catch (err) {
    throw new Error(`Failed to add trustline: ${err.message}`);
  }
};

export const removeTrustline = async (server: Server, keypair: Keypair, assetCode: string, assetIssuer: string) => {
  try {
    const transaction = new TransactionBuilder(server, {
      fee: 100,
      networkPassphrase: server.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({
        asset: new Operation.Asset(assetCode, assetIssuer),
        limit: '0',
      }))
      .setTimeout(30)
      .build();

    transaction.sign(keypair);

    await server.submitTransaction(transaction);
  } catch (err) {
    throw new Error(`Failed to remove trustline: ${err.message}`);
  }
};