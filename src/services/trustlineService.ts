import { Server, Horizon, Asset, TransactionBuilder, Networks, Operation } from '@stellar/stellar-sdk';

// Configuração da Rede
const isTestnet = true; // Pode ser configurado via variável de ambiente
const server = new Server(isTestnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org');

// Definição dos Tokens Suportados
export interface TokenConfig {
  code: string;
  issuer: string;
  name: string;
}

export const TOKENS: TokenConfig[] = [
  {
    code: 'PETC',
    issuer: 'G...SEU_ISSUER_PETC_AQUI...', // Substituir pelo endereço real do emissor
    name: 'PETC Token'
  },
  {
    code: 'VETH',
    issuer: 'G...SEU_ISSUER_VETH_AQUI...', // Substituir pelo endereço real do emissor
    name: 'VETH Token'
  },
  {
    code: 'PAWP',
    issuer: 'G...SEU_ISSUER_PAWP_AQUI...', // Substituir pelo endereço real do emissor
    name: 'PAWP Token'
  }
];

/**
 * Obtém o saldo de um token específico para uma conta
 */
export async function getTokenBalance(accountId: string, token: TokenConfig): Promise<string> {
  try {
    const account = await server.loadAccount(accountId);
    
    // O saldo nativo é XLM, procuramos pelos assets customizados
    const balance = account.balances.find(b => b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12');
    
    if (!balance) return '0';
    
    // Verifica se o asset corresponde ao token desejado
    if (balance.asset_code === token.code && balance.asset_issuer === token.issuer) {
      return balance.balance;
    }
    
    return '0';
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw new Error('Falha ao carregar saldo. Verifique sua conexão.');
  }
}

/**
 * Cria a transação para adicionar uma trustline
 */
export async function buildAddTrustlineTransaction(
  sourceKeypair: any, // Keypair do usuário
  accountId: string,
  token: TokenConfig,
  limit: string = '1000000' // Limite padrão
): Promise<Horizon.ServerApi.TransactionRecord> {
  try {
    const sourceAccount = await server.loadAccount(accountId);
    
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: Horizon.MAX_FEE,
      networkPassphrase: isTestnet ? Networks.TESTNET : Networks.PUBLIC,
    })
    .addOperation(
      Operation.changeTrust({
        type: 'changeTrust',
        asset: Asset.fromCodeAndIssuer(token.code, token.issuer),
        limit: limit,
      })
    )
    .setTimeout(30)
    .build();

    // Assina a transação localmente (na prática, isso seria feito no cliente mobile)
    transaction.sign(sourceKeypair);

    // Envia para a rede
    const result = await server.submitTransaction(transaction);
    return result;
  } catch (error: any) {
    throw handleStellarError(error);
  }
}

/**
 * Cria a transação para remover uma trustline (se o saldo for 0)
 */
export async function buildRemoveTrustlineTransaction(
  sourceKeypair: any,
  accountId: string,
  token: TokenConfig
): Promise<Horizon.ServerApi.TransactionRecord> {
  try {
    const sourceAccount = await server.loadAccount(accountId);
    
    // Verifica se há saldo antes de remover
    const currentBalance = await getTokenBalance(accountId, token);
    if (parseFloat(currentBalance) > 0) {
      throw new Error('Você deve zerar seu saldo antes de remover a trustline.');
    }

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: Horizon.MAX_FEE,
      networkPassphrase: isTestnet ? Networks.TESTNET : Networks.PUBLIC,
    })
    .addOperation(
      Operation.revokeTrustLine({
        type: 'revokeTrustLine',
        asset: Asset.fromCodeAndIssuer(token.code, token.issuer),
      })
    )
    .setTimeout(30)
    .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    return result;
  } catch (error: any) {
    throw handleStellarError(error);
  }
}

/**
 * Helper para traduzir erros do Stellar em mensagens amigáveis
 */
function handleStellarError(error: any): Error {
  if (error.response && error.response.data) {
    const details = error.response.data.extras?.result_codes?.operations || [];
    const message = details[0] || error.response.data.title || 'Erro desconhecido na operação.';
    
    // Mapeamento comum de erros
    switch (message) {
      case 'op_low_reserve':
        return new Error('Saldo insuficiente de XLM para criar a trustline.');
      case 'line_full':
        return new Error('Limite de trustline atingido.');
      case 'no_trust':
        return new Error('Emissor não confiável ou inexistente.');
      default:
        return new Error(`Erro na Blockchain: ${message}`);
    }
  }
  
  if (error.message.includes('Network request failed')) {
    return new Error('Não foi possível conectar à rede Stellar. Verifique sua internet.');
  }

  return new Error('Ocorreu um erro inesperado. Tente novamente.');
}
