import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchMulti } from '../api/tmdb';
import { colors } from '../theme';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setStatus('');
      return;
    }
    setStatus('Searching...');
    let cancelled = false;
    const timer = setTimeout(() => {
      searchMulti(q)
        .then((items) => {
          if (cancelled) return;
          setStatus(items.length ? `${items.length} results` : 'No results');
          setResults(items);
        })
        .catch((err) => {
          if (!cancelled) setStatus(err.message);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function clear() {
    setQuery('');
    setResults([]);
    setStatus('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search movies & TV..."
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable style={styles.clearBtn} onPress={clear} hitSlop={8}>
              <Text style={styles.clearBtnText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <FlatList
        data={results}
        numColumns={3}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => {
          const isPerson = item.type === 'person';
          return (
            <Pressable
              style={styles.gridCard}
              onPress={() =>
                isPerson
                  ? navigation.navigate('Person', { personId: item.id, name: item.title })
                  : navigation.navigate('Player', { type: item.type, id: item.id })
              }
            >
              {item.poster ? (
                <Image source={{ uri: item.poster }} style={[styles.gridPoster, isPerson && styles.gridPosterRound]} />
              ) : (
                <View style={[styles.gridPoster, styles.gridPosterFallback, isPerson && styles.gridPosterRound]} />
              )}
              <Text style={styles.gridTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.gridSubtitle} numberOfLines={1}>
                {isPerson ? 'Actor' : `${item.year || ''} · ${item.type}`}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchRow: { padding: 16, paddingBottom: 12 },
  inputWrap: { justifyContent: 'center' },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 34,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  clearBtn: {
    position: 'absolute',
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { color: colors.muted, fontSize: 16, lineHeight: 18 },
  status: { color: colors.muted, paddingHorizontal: 16, marginBottom: 12 },
  gridContent: { paddingHorizontal: 12, paddingBottom: 24 },
  gridCard: { flex: 1 / 3, padding: 4 },
  gridPoster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: colors.panel },
  gridPosterFallback: { borderWidth: 1, borderColor: colors.border },
  gridPosterRound: { aspectRatio: 1, borderRadius: 999 },
  gridTitle: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
  gridSubtitle: { color: colors.muted, fontSize: 11 },
});
