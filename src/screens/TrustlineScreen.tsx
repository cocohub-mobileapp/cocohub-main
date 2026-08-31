/**
 * TrustlineScreen
 * Issue #43 — Stellar Trustline Management UI (PETC / VETH / PAWP)
 *
 * Views:
 *  dashboard  — Cocohub tokens (PETC, VETH, PAWP) with on-chain & backend-earned balances,
 *               testnet mode indicator, active trustlines, reserves, and 1-tap add/remove actions.
 *  add        — Pick a Cocohub asset or enter custom asset to establish a trustline.
 *  history    — Trustline and payment transaction history on the Stellar network.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  TrustlineState,
  TrustlineAsset,
  TrustlineTransaction,
  CocohubAssetDefinition,
  CocohubAssetStatus,
  EarnedTokenBalances,
} from '../models/Trustline';
import {
  loadTrustlineState,
  addTrustline,
  removeTrustline,
  loadTrustlineHistory,
  publicKeyFromSecret,
  isValidSecretKey,
  isValidPublicKey,
  buildCocohubAssetStatuses,
  getEarnedBalances,
  isTestnetMode,
  getHorizonUrl,
  COCOHUB_ASSETS,
  XLM_RESERVE_PER_TRUSTLINE,
  TrustlineError,
  extractStellarError,
} from '../services/trustlineService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  initialSecretKey?: string;
  initialPublicKey?: string;
}

type ScreenView = 'dashboard' | 'add' | 'history';

// ─── Component ────────────────────────────────────────────────────────────────

const TrustlineScreen: React.FC<Props> = ({
  onBack,
  initialSecretKey = '',
  initialPublicKey = '',
}) => {
  const [view, setView] = useState<ScreenView>('dashboard');
  const [secretKey, setSecretKey] = useState(initialSecretKey);
  const [publicKey, setPublicKey] = useState(
    initialPublicKey ||
      (initialSecretKey && isValidSecretKey(initialSecretKey)
        ? publicKeyFromSecret(initialSecretKey)
        : ''),
  );
  const [state, setState] = useState<TrustlineState | null>(null);
  const [earnedBalances, setEarnedBalances] = useState<EarnedTokenBalances>({
    PETC: '0.00',
    VETH: '0.00',
    PAWP: '0.00',
  });
  const [history, setHistory] = useState<TrustlineTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeActionAsset, setActiveActionAsset] = useState<string | null>(null);

  // Add form
  const [addMode, setAddMode] = useState<'cocohub' | 'custom'>('cocohub');
  const [selectedAsset, setSelectedAsset] = useState<CocohubAssetDefinition | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [customIssuer, setCustomIssuer] = useState('');
  const [customLimit, setCustomLimit] = useState('');

  // Secret key entry modal
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const testnet = isTestnetMode();

  // ── Account & Rewards loading ───────────────────────────────────────────────

  const loadAccount = useCallback(async (pk: string) => {
    setLoading(true);
    try {
      const [accountState, rewards] = await Promise.all([
        loadTrustlineState(pk),
        getEarnedBalances(),
      ]);
      setState(accountState);
      if (rewards) setEarnedBalances(rewards);
    } catch (err) {
      const msg =
        extractStellarError(err) ??
        (err instanceof TrustlineError ? err.message : 'Failed to load Stellar account details.');
      Alert.alert('Account Load Failed', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (pk: string) => {
    setLoading(true);
    try {
      const h = await loadTrustlineHistory(pk);
      setHistory(h);
    } catch (err) {
      const msg =
        extractStellarError(err) ??
        (err instanceof TrustlineError ? err.message : 'Failed to load transaction history.');
      Alert.alert('History Error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (publicKey && view === 'dashboard') void loadAccount(publicKey);
    if (publicKey && view === 'history') void loadHistory(publicKey);
  }, [publicKey, view, loadAccount, loadHistory]);

  // ── Secret key entry ────────────────────────────────────────────────────────

  const handleConnectKey = () => {
    const trimmed = keyInput.trim();
    if (!isValidSecretKey(trimmed)) {
      Alert.alert('Invalid Key', 'Please enter a valid Stellar secret key (starts with S).');
      return;
    }
    try {
      const pk = publicKeyFromSecret(trimmed);
      setSecretKey(trimmed);
      setPublicKey(pk);
      setKeyModalVisible(false);
      setKeyInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not derive public key from secret.';
      Alert.alert('Key Error', msg);
    }
  };

  // ── Add trustline ───────────────────────────────────────────────────────────

  const executeAddTrustline = async (
    assetCode: string,
    issuerPublicKey: string,
    limit?: string,
  ) => {
    if (!secretKey) {
      setKeyModalVisible(true);
      return;
    }

    Alert.alert(
      'Confirm Trustline',
      `Adding ${assetCode} will lock ${XLM_RESERVE_PER_TRUSTLINE} XLM in reserve.\n\nProceed on Stellar ${testnet ? 'Testnet' : 'Public'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Trustline',
          onPress: async () => {
            setActionLoading(true);
            setActiveActionAsset(assetCode);
            try {
              const txHash = await addTrustline({
                accountSecretKey: secretKey,
                assetCode,
                issuerPublicKey,
                limit,
              });
              Alert.alert(
                'Success',
                `Trustline for ${assetCode} established!\nTX: ${txHash.slice(0, 16)}…`,
              );
              setView('dashboard');
              await loadAccount(publicKey);
            } catch (err) {
              const msg =
                extractStellarError(err) ??
                (err instanceof TrustlineError ? err.message : 'Failed to establish trustline.');
              Alert.alert('Add Trustline Failed', msg);
            } finally {
              setActionLoading(false);
              setActiveActionAsset(null);
            }
          },
        },
      ],
    );
  };

  const handleAddFormSubmit = async () => {
    let assetCode = '';
    let issuerPublicKey = '';

    if (addMode === 'cocohub') {
      if (!selectedAsset) {
        Alert.alert('Select Asset', 'Please select a Cocohub asset first.');
        return;
      }
      assetCode = selectedAsset.assetCode;
      issuerPublicKey = selectedAsset.issuerPublicKey;
    } else {
      if (!customCode.trim() || !customIssuer.trim()) {
        Alert.alert('Missing Fields', 'Please enter both asset code and issuer public key.');
        return;
      }
      if (!isValidPublicKey(customIssuer.trim())) {
        Alert.alert('Invalid Issuer', 'Issuer must be a valid Stellar public key (starts with G).');
        return;
      }
      assetCode = customCode.trim().toUpperCase();
      issuerPublicKey = customIssuer.trim();
    }

    await executeAddTrustline(assetCode, issuerPublicKey, customLimit.trim() || undefined);
  };

  // ── Remove trustline ────────────────────────────────────────────────────────

  const executeRemoveTrustline = (assetCode: string, issuerPublicKey: string, balance: string) => {
    if (!secretKey) {
      setKeyModalVisible(true);
      return;
    }

    if (parseFloat(balance) > 0) {
      Alert.alert(
        'Cannot Remove Trustline',
        `Your account holds ${balance} ${assetCode}. You must transfer, swap, or burn this balance before removing the trustline.`,
      );
      return;
    }

    Alert.alert(
      'Remove Trustline',
      `Remove trustline for ${assetCode}? This will release ${XLM_RESERVE_PER_TRUSTLINE} XLM back to your available balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            setActiveActionAsset(assetCode);
            try {
              const txHash = await removeTrustline({
                accountSecretKey: secretKey,
                assetCode,
                issuerPublicKey,
              });
              Alert.alert(
                'Removed',
                `Trustline for ${assetCode} removed.\nTX: ${txHash.slice(0, 16)}…`,
              );
              await loadAccount(publicKey);
            } catch (err) {
              const msg =
                extractStellarError(err) ??
                (err instanceof TrustlineError ? err.message : 'Failed to remove trustline.');
              Alert.alert('Remove Failed', msg);
            } finally {
              setActionLoading(false);
              setActiveActionAsset(null);
            }
          },
        },
      ],
    );
  };

  // ── Cocohub Assets & Custom Assets computation ─────────────────────────────

  const cocohubStatuses: CocohubAssetStatus[] = buildCocohubAssetStatuses(
    state?.trustlines ?? [],
    earnedBalances,
  );

  const customTrustlines: TrustlineAsset[] =
    state?.trustlines.filter(
      (tl) =>
        !COCOHUB_ASSETS.some((ca) => ca.assetCode.toUpperCase() === tl.assetCode.toUpperCase()),
    ) ?? [];

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderCocohubTokenCard = (token: CocohubAssetStatus) => {
    const isBusy = actionLoading && activeActionAsset === token.assetCode;
    const hasActiveBalance = parseFloat(token.walletBalance) > 0;

    return (
      <View key={token.assetCode} style={styles.tokenCard}>
        <View style={styles.tokenHeader}>
          <View style={styles.tokenTitleRow}>
            <Text style={styles.tokenEmoji}>{token.iconEmoji}</Text>
            <View style={styles.tokenMeta}>
              <View style={styles.tokenCodeBadgeRow}>
                <Text style={styles.tokenCode}>{token.assetCode}</Text>
                <View
                  style={[
                    styles.statusPill,
                    token.hasTrustline ? styles.statusPillActive : styles.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      token.hasTrustline
                        ? styles.statusPillTextActive
                        : styles.statusPillTextInactive,
                    ]}
                  >
                    {token.hasTrustline ? '● Active' : '○ Not Added'}
                  </Text>
                </View>
              </View>
              <Text style={styles.tokenName}>{token.name}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.tokenDesc}>{token.description}</Text>

        <View style={styles.balanceGrid}>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceBoxLabel}>Wallet Balance</Text>
            <Text style={styles.balanceBoxValue}>
              {parseFloat(token.walletBalance).toFixed(2)}{' '}
              <Text style={styles.balanceBoxUnit}>{token.assetCode}</Text>
            </Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceBoxLabel}>Earned (Backend)</Text>
            <Text style={[styles.balanceBoxValue, { color: '#059669' }]}>
              {parseFloat(token.earnedBalance).toFixed(2)}{' '}
              <Text style={styles.balanceBoxUnit}>{token.assetCode}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.issuerRow}>
          <Text style={styles.issuerLabel}>Issuer: </Text>
          <Text style={styles.issuerKey} numberOfLines={1}>
            {token.issuerPublicKey.slice(0, 10)}…{token.issuerPublicKey.slice(-6)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          {token.hasTrustline ? (
            <TouchableOpacity
              style={[
                styles.removeButton,
                hasActiveBalance && styles.removeButtonDisabled,
                isBusy && styles.btnDisabled,
              ]}
              onPress={() =>
                executeRemoveTrustline(token.assetCode, token.issuerPublicKey, token.walletBalance)
              }
              disabled={actionLoading}
              accessibilityRole="button"
              accessibilityLabel={`Remove trustline for ${token.assetCode}`}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Text
                  style={[
                    styles.removeButtonText,
                    hasActiveBalance && styles.removeButtonTextDisabled,
                  ]}
                >
                  {hasActiveBalance ? 'Cannot Remove (Balance > 0)' : 'Remove Trustline'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.addButton, isBusy && styles.btnDisabled]}
              onPress={() => executeAddTrustline(token.assetCode, token.issuerPublicKey)}
              disabled={actionLoading}
              accessibilityRole="button"
              accessibilityLabel={`Add trustline for ${token.assetCode}`}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.addButtonText}>+ Add Trustline (0.5 XLM Reserve)</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderCustomTrustline = ({ item }: { item: TrustlineAsset }) => {
    const isBusy = actionLoading && activeActionAsset === item.assetCode;
    const hasActiveBalance = parseFloat(item.balance) > 0;

    return (
      <View style={styles.tlCard}>
        <View style={styles.tlRow}>
          <View style={styles.tlLeft}>
            <Text style={styles.tlCode}>{item.assetCode}</Text>
            {item.issuerLabel && <Text style={styles.tlLabel}>{item.issuerLabel}</Text>}
            <Text style={styles.tlIssuer} numberOfLines={1}>
              {item.issuerPublicKey.slice(0, 8)}…{item.issuerPublicKey.slice(-6)}
            </Text>
          </View>
          <View style={styles.tlRight}>
            <Text style={styles.tlBalance}>{parseFloat(item.balance).toFixed(2)}</Text>
            <Text style={styles.tlLimit}>Limit: {parseFloat(item.limit).toLocaleString()}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.removeBtn,
            hasActiveBalance && styles.removeBtnDisabled,
            isBusy && styles.btnDisabled,
          ]}
          onPress={() => executeRemoveTrustline(item.assetCode, item.issuerPublicKey, item.balance)}
          disabled={actionLoading}
          accessibilityRole="button"
          accessibilityLabel={`Remove trustline for ${item.assetCode}`}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Text style={[styles.removeBtnText, hasActiveBalance && { color: '#9CA3AF' }]}>
              {hasActiveBalance ? 'Cannot Remove (Balance > 0)' : 'Remove Trustline'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderHistoryItem = ({ item }: { item: TrustlineTransaction }) => (
    <View style={[styles.histCard, !item.successful && styles.histCardFailed]}>
      <View style={styles.histRow}>
        <Text style={styles.histIcon}>{histIcon(item.type)}</Text>
        <View style={styles.histMeta}>
          <Text style={styles.histType}>{histLabel(item.type)}</Text>
          <Text style={styles.histAsset}>{item.assetCode}</Text>
        </View>
        {item.amount && <Text style={styles.histAmount}>{parseFloat(item.amount).toFixed(2)}</Text>}
      </View>
      <Text style={styles.histTx}>TX: {item.txHash.slice(0, 16)}…</Text>
      <Text style={styles.histDate}>{new Date(item.createdAt).toLocaleString()}</Text>
    </View>
  );

  // ── History view ────────────────────────────────────────────────────────────

  if (view === 'history') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('dashboard')} accessibilityRole="button">
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction History</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.networkBanner}>
          <Text style={styles.networkBannerText}>
            {testnet ? '🧪 Stellar Testnet Mode' : '🌐 Stellar Public Network'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#10B981" />
        ) : (
          <FlatList
            data={history}
            keyExtractor={(h) => h.id}
            renderItem={renderHistoryItem}
            contentContainerStyle={history.length === 0 ? styles.emptyContainer : styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No trustline transactions found.</Text>
            }
          />
        )}
      </View>
    );
  }

  // ── Add trustline view ──────────────────────────────────────────────────────

  if (view === 'add') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('dashboard')} accessibilityRole="button">
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Trustline</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.networkBanner}>
          <Text style={styles.networkBannerText}>
            {testnet ? '🧪 Stellar Testnet Mode' : '🌐 Stellar Public Network'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.formBody}>
          {/* Reserve warning */}
          <View style={styles.reserveWarning}>
            <Text style={styles.reserveWarningTitle}>⚠️ XLM Reserve Required</Text>
            <Text style={styles.reserveWarningBody}>
              Each trustline locks {XLM_RESERVE_PER_TRUSTLINE} XLM as a Stellar network reserve.
              This XLM is automatically released back when you remove the trustline.
              {state ? `\n\nYour available XLM: ${state.availableXlm}` : ''}
            </Text>
          </View>

          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, addMode === 'cocohub' && styles.modeBtnActive]}
              onPress={() => setAddMode('cocohub')}
            >
              <Text style={[styles.modeBtnText, addMode === 'cocohub' && styles.modeBtnTextActive]}>
                Cocohub Assets
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, addMode === 'custom' && styles.modeBtnActive]}
              onPress={() => setAddMode('custom')}
            >
              <Text style={[styles.modeBtnText, addMode === 'custom' && styles.modeBtnTextActive]}>
                Custom Asset
              </Text>
            </TouchableOpacity>
          </View>

          {addMode === 'cocohub' ? (
            <>
              <Text style={styles.formLabel}>Select Asset</Text>
              {COCOHUB_ASSETS.map((asset) => (
                <TouchableOpacity
                  key={asset.assetCode}
                  style={[
                    styles.assetCard,
                    selectedAsset?.assetCode === asset.assetCode && styles.assetCardSelected,
                  ]}
                  onPress={() => setSelectedAsset(asset)}
                  accessibilityRole="button"
                >
                  <Text style={styles.assetIcon}>{asset.iconEmoji}</Text>
                  <View style={styles.assetInfo}>
                    <Text style={styles.assetCode}>{asset.assetCode}</Text>
                    <Text style={styles.assetName}>{asset.name}</Text>
                    <Text style={styles.assetDesc}>{asset.description}</Text>
                  </View>
                  {selectedAsset?.assetCode === asset.assetCode && (
                    <Text style={styles.assetCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.formLabel}>Asset Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. USDC"
                placeholderTextColor="#9CA3AF"
                value={customCode}
                onChangeText={setCustomCode}
                autoCapitalize="characters"
                maxLength={12}
                accessibilityLabel="Asset code"
              />
              <Text style={styles.formLabel}>Issuer Public Key</Text>
              <TextInput
                style={styles.input}
                placeholder="G…"
                placeholderTextColor="#9CA3AF"
                value={customIssuer}
                onChangeText={setCustomIssuer}
                autoCapitalize="characters"
                accessibilityLabel="Issuer public key"
              />
              <Text style={styles.formLabel}>Limit (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Leave blank for maximum"
                placeholderTextColor="#9CA3AF"
                value={customLimit}
                onChangeText={setCustomLimit}
                keyboardType="numeric"
                accessibilityLabel="Trustline limit"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.addBtn, actionLoading && styles.btnDisabled]}
            onPress={() => void handleAddFormSubmit()}
            disabled={actionLoading}
            accessibilityRole="button"
            accessibilityLabel="Add trustline"
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addBtnText}>Add Trustline</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Dashboard view ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stellar Trustlines</Text>
        <TouchableOpacity onPress={() => setView('add')} accessibilityRole="button">
          <Text style={styles.addHeaderBtn}>+ Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Network banner */}
      <View style={styles.networkBanner}>
        <Text style={styles.networkBannerText}>
          {testnet ? '🧪 Stellar Testnet Mode' : '🌐 Stellar Public Network'}
        </Text>
        <Text style={styles.networkSubText}>{getHorizonUrl().replace('https://', '')}</Text>
      </View>

      {!publicKey ? (
        <View style={styles.connectContainer}>
          <Text style={styles.connectIcon}>🔑</Text>
          <Text style={styles.connectTitle}>Connect Stellar Account</Text>
          <Text style={styles.connectSubtitle}>
            Enter your Stellar secret key to view and manage PETC, VETH, and PAWP trustlines.{'\n'}
            Your secret key is signed locally and never leaves this device.
          </Text>
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={() => setKeyModalVisible(true)}
            accessibilityRole="button"
          >
            <Text style={styles.connectBtnText}>Connect Account</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#10B981" />
      ) : (
        <ScrollView contentContainerStyle={styles.dashBody}>
          {/* Account summary card */}
          {state && (
            <View style={styles.accountCard}>
              <View style={styles.accountHeaderRow}>
                <View>
                  <Text style={styles.accountLabel}>Connected Account</Text>
                  <Text style={styles.accountKey} numberOfLines={1}>
                    {state.accountPublicKey.slice(0, 12)}…{state.accountPublicKey.slice(-8)}
                  </Text>
                </View>
                <View style={styles.testnetPill}>
                  <Text style={styles.testnetPillText}>{testnet ? 'TESTNET' : 'MAINNET'}</Text>
                </View>
              </View>

              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceValue}>{parseFloat(state.xlmBalance).toFixed(2)}</Text>
                  <Text style={styles.balanceLabel}>XLM Balance</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceValue}>{state.totalReservedXlm.toFixed(2)}</Text>
                  <Text style={styles.balanceLabel}>Reserved XLM</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={[styles.balanceValue, { color: '#10B981' }]}>
                    {parseFloat(state.availableXlm).toFixed(2)}
                  </Text>
                  <Text style={styles.balanceLabel}>Available XLM</Text>
                </View>
              </View>

              <Text style={styles.reserveNote}>
                {state.trustlines.length} active trustline{state.trustlines.length !== 1 ? 's' : ''}{' '}
                · {XLM_RESERVE_PER_TRUSTLINE} XLM reserved per trustline
              </Text>
            </View>
          )}

          {/* Cocohub Tokens Section */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Cocohub Ecosystem Tokens</Text>
              <Text style={styles.sectionSubtitle}>
                Manage trustlines & view on-chain vs earned rewards
              </Text>
            </View>
            <TouchableOpacity onPress={() => setView('history')}>
              <Text style={styles.historyLink}>History →</Text>
            </TouchableOpacity>
          </View>

          {cocohubStatuses.map((status) => renderCocohubTokenCard(status))}

          {/* Custom Trustlines Section (if any exist) */}
          {customTrustlines.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                <Text style={styles.sectionTitle}>Other Trustlines</Text>
              </View>
              <FlatList
                data={customTrustlines}
                keyExtractor={(t) => `${t.assetCode}-${t.issuerPublicKey}`}
                renderItem={renderCustomTrustline}
                scrollEnabled={false}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => void loadAccount(publicKey)}
            accessibilityRole="button"
          >
            <Text style={styles.refreshBtnText}>↻ Refresh Balances</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Secret key modal */}
      <Modal
        visible={keyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setKeyModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.keySheet}>
            <Text style={styles.keySheetTitle}>Enter Secret Key</Text>
            <Text style={styles.keySheetSubtitle}>
              Your secret key is used client-side to sign Stellar trustline transactions. It is
              never transmitted to the server.
            </Text>
            <TextInput
              style={styles.keyInput}
              placeholder="S…"
              placeholderTextColor="#9CA3AF"
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="characters"
              secureTextEntry
              accessibilityLabel="Stellar secret key"
            />
            <TouchableOpacity style={styles.connectBtn} onPress={handleConnectKey}>
              <Text style={styles.connectBtnText}>Connect Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setKeyModalVisible(false);
                setKeyInput('');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function histIcon(type: TrustlineTransaction['type']): string {
  return { add_trustline: '🔗', remove_trustline: '🗑️', payment: '💸' }[type] ?? '•';
}

function histLabel(type: TrustlineTransaction['type']): string {
  return (
    { add_trustline: 'Add Trustline', remove_trustline: 'Remove Trustline', payment: 'Payment' }[
      type
    ] ?? type
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backText: { color: '#10B981', fontSize: 16, fontWeight: '600', minWidth: 50 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  addHeaderBtn: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  networkBanner: {
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  networkBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  networkSubText: {
    fontSize: 11,
    color: '#047857',
    fontFamily: 'monospace',
  },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#9CA3AF', fontSize: 15, textAlign: 'center' },

  // Connect screen
  connectContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  connectIcon: { fontSize: 52, marginBottom: 16 },
  connectTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  connectSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  connectBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Dashboard
  dashBody: { padding: 16 },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accountLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  accountKey: { fontSize: 13, color: '#374151', fontFamily: 'monospace' },
  testnetPill: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  testnetPillText: { fontSize: 10, fontWeight: '700', color: '#03543F' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  balanceItem: { alignItems: 'center', flex: 1 },
  balanceValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  balanceLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  reserveNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  sectionSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  historyLink: { fontSize: 13, color: '#10B981', fontWeight: '600' },

  // Cocohub Token Cards
  tokenCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tokenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tokenTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  tokenEmoji: { fontSize: 28 },
  tokenMeta: { flex: 1 },
  tokenCodeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenCode: { fontSize: 17, fontWeight: '800', color: '#111827' },
  tokenName: { fontSize: 13, color: '#4B5563', marginTop: 1 },
  tokenDesc: { fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 16 },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusPillActive: { backgroundColor: '#D1FAE5' },
  statusPillInactive: { backgroundColor: '#F3F4F6' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusPillTextActive: { color: '#065F46' },
  statusPillTextInactive: { color: '#6B7280' },

  balanceGrid: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 12,
  },
  balanceBox: { flex: 1 },
  balanceBoxLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  balanceBoxValue: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 2 },
  balanceBoxUnit: { fontSize: 12, fontWeight: '500', color: '#6B7280' },

  issuerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  issuerLabel: { fontSize: 11, color: '#9CA3AF' },
  issuerKey: { fontSize: 11, color: '#6B7280', fontFamily: 'monospace', flex: 1 },

  actionRow: { marginTop: 12 },
  addButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  removeButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  removeButtonDisabled: { backgroundColor: '#F3F4F6' },
  removeButtonText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  removeButtonTextDisabled: { color: '#9CA3AF' },

  refreshBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  refreshBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },

  // Custom trustline card
  tlCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tlRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tlLeft: { flex: 1 },
  tlRight: { alignItems: 'flex-end' },
  tlCode: { fontSize: 16, fontWeight: '700', color: '#111827' },
  tlLabel: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 2 },
  tlIssuer: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' },
  tlBalance: { fontSize: 18, fontWeight: '800', color: '#111827' },
  tlLimit: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  removeBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  removeBtnDisabled: { backgroundColor: '#F3F4F6' },
  removeBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },

  // History card
  histCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  histCardFailed: { borderLeftColor: '#EF4444' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  histIcon: { fontSize: 18 },
  histMeta: { flex: 1 },
  histType: { fontSize: 13, fontWeight: '600', color: '#111827' },
  histAsset: { fontSize: 12, color: '#6B7280' },
  histAmount: { fontSize: 14, fontWeight: '700', color: '#111827' },
  histTx: { fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' },
  histDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Add form
  formBody: { padding: 20 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnActive: { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
  modeBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  modeBtnTextActive: { color: '#065F46' },

  reserveWarning: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  reserveWarningTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  reserveWarningBody: { fontSize: 13, color: '#78350F', lineHeight: 18 },

  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  assetCardSelected: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  assetIcon: { fontSize: 28 },
  assetInfo: { flex: 1 },
  assetCode: { fontSize: 15, fontWeight: '700', color: '#111827' },
  assetName: { fontSize: 13, color: '#374151', marginTop: 1 },
  assetDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  assetCheck: { fontSize: 18, color: '#10B981', fontWeight: '700' },

  addBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },

  // Key modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  keySheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  keySheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  keySheetSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 16 },
  keyInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#6B7280', fontSize: 14 },
});

export default TrustlineScreen;
