/**
 * TrustlineScreen
 * Issue #101 — Stellar Trustline Management UI
 *
 * Views:
 *  dashboard  — active trustlines, XLM balance/reserves, add/remove actions
 *  add        — pick a Cocohub asset or enter custom asset to add trustline
 *  history    — trustline + payment transaction history
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
} from '../models/Trustline';
import {
  loadTrustlineState,
  addTrustline,
  removeTrustline,
  loadTrustlineHistory,
  publicKeyFromSecret,
  isValidSecretKey,
  isValidPublicKey,
  COCOHUB_ASSETS,
  STELLAR_NETWORK,
  XLM_RESERVE_PER_TRUSTLINE,
  TrustlineError,
} from '../services/trustlineService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

type ScreenView = 'dashboard' | 'add' | 'history';

// ─── Component ────────────────────────────────────────────────────────────────

const TrustlineScreen: React.FC<Props> = ({ onBack }) => {
  const [view, setView] = useState<ScreenView>('dashboard');
  const [secretKey, setSecretKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [state, setState] = useState<TrustlineState | null>(null);
  const [history, setHistory] = useState<TrustlineTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Add form
  const [addMode, setAddMode] = useState<'cocohub' | 'custom'>('cocohub');
  const [selectedAsset, setSelectedAsset] = useState<CocohubAssetDefinition | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [customIssuer, setCustomIssuer] = useState('');
  const [customLimit, setCustomLimit] = useState('');

  // Secret key entry modal
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  // ── Account loading ─────────────────────────────────────────────────────────

  const loadAccount = useCallback(async (pk: string) => {
    setLoading(true);
    try {
      const s = await loadTrustlineState(pk);
      setState(s);
    } catch (err) {
      Alert.alert('Error', err instanceof TrustlineError ? err.message : 'Failed to load account.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (pk: string) => {
    setLoading(true);
    try {
      const h = await loadTrustlineHistory(pk);
      setHistory(h);
    } catch {
      Alert.alert('Error', 'Failed to load transaction history.');
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
    if (!isValidSecretKey(keyInput.trim())) {
      Alert.alert('Invalid Key', 'Please enter a valid Stellar secret key (starts with S).');
      return;
    }
    try {
      const pk = publicKeyFromSecret(keyInput.trim());
      setSecretKey(keyInput.trim());
      setPublicKey(pk);
      setKeyModalVisible(false);
      setKeyInput('');
    } catch {
      Alert.alert('Error', 'Could not derive public key from secret.');
    }
  };

  // ── Add trustline ───────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!secretKey) {
      setKeyModalVisible(true);
      return;
    }

    let assetCode = '';
    let issuerPublicKey = '';

    if (addMode === 'cocohub') {
      if (!selectedAsset) {
        Alert.alert('Select an asset first.');
        return;
      }
      assetCode = selectedAsset.assetCode;
      issuerPublicKey = selectedAsset.issuerPublicKey;
    } else {
      if (!customCode.trim() || !customIssuer.trim()) {
        Alert.alert('Missing Info', 'Enter both asset code and issuer public key.');
        return;
      }
      if (!isValidPublicKey(customIssuer.trim())) {
        Alert.alert('Invalid Issuer', 'Issuer must be a valid Stellar public key.');
        return;
      }
      assetCode = customCode.trim().toUpperCase();
      issuerPublicKey = customIssuer.trim();
    }

    // Reserve warning
    Alert.alert(
      'XLM Reserve Required',
      `Adding this trustline will lock ${XLM_RESERVE_PER_TRUSTLINE} XLM as a reserve. You need at least ${XLM_RESERVE_PER_TRUSTLINE} XLM available. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Trustline',
          onPress: async () => {
            setActionLoading(true);
            try {
              const txHash = await addTrustline({
                accountSecretKey: secretKey,
                assetCode,
                issuerPublicKey,
                limit: customLimit.trim() || undefined,
              });
              Alert.alert('Success', `Trustline added!\nTX: ${txHash.slice(0, 16)}…`);
              setView('dashboard');
              await loadAccount(publicKey);
            } catch (err) {
              Alert.alert(
                'Failed',
                err instanceof TrustlineError ? err.message : 'Add trustline failed.',
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── Remove trustline ────────────────────────────────────────────────────────

  const handleRemove = (tl: TrustlineAsset) => {
    if (!secretKey) {
      setKeyModalVisible(true);
      return;
    }
    if (parseFloat(tl.balance) > 0) {
      Alert.alert(
        'Cannot Remove',
        `Balance is ${tl.balance} ${tl.assetCode}. Transfer or burn the balance before removing the trustline.`,
      );
      return;
    }
    Alert.alert(
      'Remove Trustline',
      `Remove trustline for ${tl.assetCode}? This will release ${XLM_RESERVE_PER_TRUSTLINE} XLM from reserve.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const txHash = await removeTrustline({
                accountSecretKey: secretKey,
                assetCode: tl.assetCode,
                issuerPublicKey: tl.issuerPublicKey,
              });
              Alert.alert('Removed', `Trustline removed.\nTX: ${txHash.slice(0, 16)}…`);
              await loadAccount(publicKey);
            } catch (err) {
              Alert.alert('Failed', err instanceof TrustlineError ? err.message : 'Remove failed.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderTrustline = ({ item }: { item: TrustlineAsset }) => (
    <View style={styles.tlCard}>
      <View style={styles.tlRow}>
        <View style={styles.tlLeft}>
          <Text style={styles.tlCode}>
            {item.isCocohubAsset ? '🐾 ' : ''}
            {item.assetCode}
          </Text>
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
        style={[styles.removeBtn, parseFloat(item.balance) > 0 && styles.removeBtnDisabled]}
        onPress={() => handleRemove(item)}
        disabled={actionLoading}
        accessibilityRole="button"
        accessibilityLabel={`Remove trustline for ${item.assetCode}`}
      >
        <Text style={styles.removeBtnText}>Remove Trustline</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCocohubAssetManager = () => {
    if (!state) return null;

    return (
      <View style={styles.cocohubSection}>
        <Text style={styles.sectionTitle}>Cocohub Token Management</Text>
        {COCOHUB_ASSETS.map((asset) => {
          const trustline = state.trustlines.find(
            (tl) =>
              tl.assetCode === asset.assetCode && tl.issuerPublicKey === asset.issuerPublicKey,
          );
          const hasTrustline = Boolean(trustline);
          const balance = trustline?.balance ?? '0';
          const canRemove = trustline ? parseFloat(trustline.balance) === 0 : false;

          return (
            <View key={asset.assetCode} style={styles.cocohubAssetCard}>
              <View style={styles.cocohubAssetHeader}>
                <Text style={styles.assetIcon}>{asset.iconEmoji}</Text>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetCode}>{asset.assetCode}</Text>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetDesc}>{asset.description}</Text>
                </View>
                <View style={styles.cocohubBalanceBlock}>
                  <Text style={styles.cocohubBalance}>{parseFloat(balance).toFixed(2)}</Text>
                  <Text style={styles.cocohubBalanceLabel}>Balance</Text>
                </View>
              </View>

              <View style={styles.cocohubAssetFooter}>
                <Text
                  style={[
                    styles.trustlineStatus,
                    hasTrustline ? styles.trustlineStatusActive : styles.trustlineStatusMissing,
                  ]}
                >
                  {hasTrustline ? 'Trustline active' : 'No trustline'}
                </Text>
                {hasTrustline ? (
                  <TouchableOpacity
                    style={[styles.assetActionBtn, !canRemove && styles.assetActionBtnDisabled]}
                    onPress={() => trustline && handleRemove(trustline)}
                    disabled={!canRemove || actionLoading}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${asset.assetCode} trustline`}
                  >
                    <Text style={styles.assetActionText}>Remove</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.assetActionBtn}
                    onPress={() => {
                      setAddMode('cocohub');
                      setSelectedAsset(asset);
                      setView('add');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${asset.assetCode} trustline`}
                  >
                    <Text style={styles.assetActionText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
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
        <ScrollView contentContainerStyle={styles.formBody}>
          {/* Reserve warning */}
          <View style={styles.reserveWarning}>
            <Text style={styles.reserveWarningTitle}>⚠️ XLM Reserve Required</Text>
            <Text style={styles.reserveWarningBody}>
              Each trustline locks {XLM_RESERVE_PER_TRUSTLINE} XLM as a Stellar network reserve.
              This XLM is returned when you remove the trustline.
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
            onPress={() => void handleAdd()}
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
          <Text style={styles.addHeaderBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {!publicKey ? (
        <View style={styles.connectContainer}>
          <Text style={styles.connectIcon}>🔑</Text>
          <Text style={styles.connectTitle}>Connect Your Stellar Account</Text>
          <Text style={styles.connectSubtitle}>
            Enter your Stellar secret key to manage trustlines.{'\n'}
            Your key never leaves this device.
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
      ) : state ? (
        <ScrollView contentContainerStyle={styles.dashBody}>
          {/* Account summary */}
          <View style={styles.accountCard}>
            <Text style={styles.accountLabel}>Account</Text>
            <Text style={styles.accountKey} numberOfLines={1}>
              {state.accountPublicKey.slice(0, 12)}…{state.accountPublicKey.slice(-8)}
            </Text>
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
              {state.trustlines.length} trustline{state.trustlines.length !== 1 ? 's' : ''} ·{' '}
              {XLM_RESERVE_PER_TRUSTLINE} XLM reserved each
            </Text>
            <View style={styles.networkBadge}>
              <Text style={styles.networkBadgeText}>
                {STELLAR_NETWORK === 'PUBLIC' ? 'Public Stellar network' : 'Stellar testnet mode'}
              </Text>
            </View>
          </View>

          {renderCocohubAssetManager()}

          {/* Trustlines list */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Trustlines</Text>
            <TouchableOpacity onPress={() => setView('history')}>
              <Text style={styles.historyLink}>History →</Text>
            </TouchableOpacity>
          </View>

          {state.trustlines.length === 0 ? (
            <View style={styles.emptyTl}>
              <Text style={styles.emptyTlText}>No trustlines yet.</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => setView('add')}>
                <Text style={styles.addBtnText}>Add Your First Trustline</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={state.trustlines}
              keyExtractor={(t) => `${t.assetCode}-${t.issuerPublicKey}`}
              renderItem={renderTrustline}
              scrollEnabled={false}
            />
          )}

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => void loadAccount(publicKey)}
            accessibilityRole="button"
          >
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

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
              Your secret key is used locally to sign transactions and is never transmitted.
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
              <Text style={styles.connectBtnText}>Connect</Text>
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
  },
  accountLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 4 },
  accountKey: { fontSize: 13, color: '#374151', fontFamily: 'monospace', marginBottom: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  balanceItem: { alignItems: 'center', flex: 1 },
  balanceValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  balanceLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  reserveNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  networkBadge: {
    alignSelf: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  networkBadgeText: { color: '#3730A3', fontSize: 12, fontWeight: '700' },

  cocohubSection: { marginBottom: 16 },
  cocohubAssetCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cocohubAssetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cocohubBalanceBlock: { alignItems: 'flex-end' },
  cocohubBalance: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cocohubBalanceLabel: { fontSize: 11, color: '#6B7280' },
  cocohubAssetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  trustlineStatus: { fontSize: 12, fontWeight: '700' },
  trustlineStatusActive: { color: '#047857' },
  trustlineStatusMissing: { color: '#92400E' },
  assetActionBtn: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  assetActionBtnDisabled: { backgroundColor: '#D1D5DB' },
  assetActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  historyLink: { fontSize: 13, color: '#10B981', fontWeight: '600' },

  emptyTl: { alignItems: 'center', paddingVertical: 24 },
  emptyTlText: { fontSize: 14, color: '#9CA3AF', marginBottom: 16 },

  refreshBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  refreshBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },

  // Trustline card
  tlCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
