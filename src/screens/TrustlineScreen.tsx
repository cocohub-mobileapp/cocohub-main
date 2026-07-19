import React, { useState, useEffect } from 'react';
import { useStellarContext } from '../context/StellarContext';
import { addTrustline, removeTrustline, getBalances } from '../services/trustlineService';

const TrustlineScreen: React.FC = () => {
  const [balances, setBalances] = useState({});
  const [earnedBalance, setEarnedBalance] = useState(0);
  const [error, setError] = useState('');
  const [isTestnet, setIsTestnet] = useState(false);
  const { server, keypair } = useStellarContext();

  useEffect(() => {
    if (server && keypair) {
      fetchBalances();
      checkTestnet();
    }
  }, [server, keypair]);

  const fetchBalances = async () => {
    try {
      const balances = await getBalances(server, keypair.publicKey());
      setBalances(balances);
      setEarnedBalance(balances.earned || 0);
    } catch (err) {
      setError(`Error fetching balances: ${err.message}`);
    }
  };

  const checkTestnet = () => {
    setIsTestnet(server.serverUrl.includes('testnet'));
  };

  const handleAddTrustline = async (assetCode: string, assetIssuer: string) => {
    try {
      await addTrustline(server, keypair, assetCode, assetIssuer);
      fetchBalances();
    } catch (err) {
      setError(`Error adding trustline: ${err.message}`);
    }
  };

  const handleRemoveTrustline = async (assetCode: string, assetIssuer: string) => {
    try {
      await removeTrustline(server, keypair, assetCode, assetIssuer);
      fetchBalances();
    } catch (err) {
      setError(`Error removing trustline: ${err.message}`);
    }
  };

  return (
    <div>
      <h1>Trustline Management</h1>
      {isTestnet ? <p><strong>Testnet Mode</strong></p> : null}
      <h2>Balances</h2>
      <ul>
        <li>PETC: {balances.PETC || 0}</li>
        <li>VETH: {balances.VETH || 0}</li>
        <li>PAWP: {balances.PAWP || 0}</li>
      </ul>
      <h2>Earned Balance</h2>
      <p>{earnedBalance}</p>
      <h2>Actions</h2>
      <button onClick={() => handleAddTrustline('PETC', 'PETC_ISSUER')}>Add PETC Trustline</button>
      <button onClick={() => handleRemoveTrustline('PETC', 'PETC_ISSUER')}>Remove PETC Trustline</button>
      <button onClick={() => handleAddTrustline('VETH', 'VETH_ISSUER')}>Add VETH Trustline</button>
      <button onClick={() => handleRemoveTrustline('VETH', 'VETH_ISSUER')}>Remove VETH Trustline</button>
      <button onClick={() => handleAddTrustline('PAWP', 'PAWP_ISSUER')}>Add PAWP Trustline</button>
      <button onClick={() => handleRemoveTrustline('PAWP', 'PAWP_ISSUER')}>Remove PAWP Trustline</button>
      {error ? <p><strong>Error:</strong> {error}</p> : null}
    </div>
  );
};

export default TrustlineScreen;