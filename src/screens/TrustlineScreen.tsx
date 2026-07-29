import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppTheme } from '../theme';
import { addTrustline, COCOHUB_TOKENS, fetchTrustlines, removeTrustline, type TrustlineToken } from '../services/trustlineService';

export default function TrustlineScreen() {
  const colors = useAppTheme();
  const [tokens, setTokens] = useState<TrustlineToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [publicKey] = useState('G...');

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTrustlines(publicKey);
      setTokens(data);
    } catch {
      Alert.alert('Error', 'Failed to load token balances.');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const handleToggleTrustline = async (token: TrustlineToken) => {
    setActionLoading(token.assetCode);
    try {
      if (token.trustlineSet) {
        if (parseFloat(token.balance) > 0) {
          Alert.alert('Cannot Remove', `Your ${token.assetCode} balance must be 0 before removing the trustline.`);
          return;
        }
        await removeTrustline(token.assetCode);
      } else {
        await addTrustline(token.assetCode, token.issuer);
      }
      await loadTokens();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.testnetBanner, { backgroundColor: colors.warning, opacity: 0.15 }]}>
        <Text style={[styles.testnetText, { color: colors.warning }]}>
          ⚠️ Testnet Mode — tokens have no real value
        </Text>
      </View>

      <FlatList
        data={tokens}
        keyExtractor={(item) => item.assetCode}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const info = COCOHUB_TOKENS.find((t) => t.code === item.assetCode);
          return (
            <View style={[styles.tokenCard, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.tokenHeader}>
                <View style={[styles.tokenIcon, { backgroundColor: colors.primaryMuted }]}>
                  <Text style={[styles.tokenIconText, { color: colors.primary }]}>{item.assetCode.slice(0, 2)}</Text>
                </View>
                <View style={styles.tokenInfo}>
                  <Text style={[styles.tokenName, { color: colors.text }]}>{info?.name || item.assetCode}</Text>
                  <Text style={[styles.tokenDesc, { color: colors.secondaryText }]}>{info?.desc || ''}</Text>
                </View>
              </View>

              <View style={styles.tokenDetails}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.placeholder }]}>Balance</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{item.balance}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.placeholder }]}>Limit</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{parseInt(item.limit).toLocaleString()}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: item.trustlineSet ? colors.error + '20' : colors.primary,
                    borderColor: item.trustlineSet ? colors.error : colors.primary,
                  },
                ]}
                onPress={() => handleToggleTrustline(item)}
                disabled={actionLoading === item.assetCode}
              >
                {actionLoading === item.assetCode ? (
                  <ActivityIndicator size="small" color={item.trustlineSet ? colors.error : colors.white} />
                ) : (
                  <Text style={{ color: item.trustlineSet ? colors.error : colors.white, fontWeight: '700', fontSize: 14 }}>
                    {item.trustlineSet ? 'Remove Trustline' : 'Add Trustline'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        refreshing={loading}
        onRefresh={loadTokens}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  testnetBanner: { padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, alignItems: 'center' },
  testnetText: { fontSize: 13, fontWeight: '600' },
  tokenCard: { borderRadius: 14, padding: 18, marginBottom: 14, borderWidth: 1, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tokenHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  tokenIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  tokenIconText: { fontSize: 16, fontWeight: '800' },
  tokenInfo: { flex: 1 },
  tokenName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  tokenDesc: { fontSize: 12, lineHeight: 16 },
  tokenDetails: { marginBottom: 14, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  actionBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
});
