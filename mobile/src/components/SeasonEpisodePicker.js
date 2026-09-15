import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchDetails, fetchSeason, posterUrl } from '../api/tmdb';
import { colors } from '../theme';

// The "☰" badge on a TV card (MediaCard) opens this instead of navigating
// straight into the player, so you can jump to a specific episode without
// leaving the browse screen.
export default function SeasonEpisodePicker({ visible, tvId, title, onClose, onSelect }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !tvId) return;
    let cancelled = false;
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(null);
    setLoading(true);
    fetchDetails('tv', tvId)
      .then((data) => {
        if (cancelled) return;
        const realSeasons = (data.seasons || []).filter((s) => s.episode_count > 0);
        setSeasons(realSeasons);
        setSelectedSeason(realSeasons[0]?.season_number ?? 1);
      })
      .catch(() => {
        if (!cancelled) setSeasons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, tvId]);

  useEffect(() => {
    if (!visible || !tvId || !selectedSeason) return;
    let cancelled = false;
    setLoading(true);
    fetchSeason(tvId, selectedSeason)
      .then((data) => {
        if (!cancelled) setEpisodes(data.episodes || []);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, tvId, selectedSeason]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonRow}>
          {seasons.map((s) => {
            const active = s.season_number === selectedSeason;
            return (
              <Pressable
                key={s.season_number}
                style={[styles.seasonChip, active && styles.seasonChipActive]}
                onPress={() => setSelectedSeason(s.season_number)}
              >
                <Text style={[styles.seasonChipText, active && styles.seasonChipTextActive]}>
                  {s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : (
            <FlatList
              data={episodes}
              keyExtractor={(item) => String(item.episode_number)}
              contentContainerStyle={styles.episodeList}
              renderItem={({ item }) => (
                <Pressable style={styles.episodeRow} onPress={() => onSelect(selectedSeason, item.episode_number)}>
                  {item.still_path ? (
                    <Image source={{ uri: posterUrl(item.still_path) }} style={styles.episodeThumb} />
                  ) : (
                    <View style={[styles.episodeThumb, styles.episodeThumbFallback]} />
                  )}
                  <View style={styles.episodeInfo}>
                    <Text style={styles.episodeTitle} numberOfLines={1}>
                      {item.episode_number}. {item.name}
                    </Text>
                    {item.overview ? (
                      <Text style={styles.episodeOverview} numberOfLines={2}>
                        {item.overview}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 },
  seasonRow: { flexGrow: 0, paddingLeft: 16, marginBottom: 8 },
  seasonChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  seasonChipActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  seasonChipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  seasonChipTextActive: { color: colors.accent },
  body: { flex: 1 },
  loading: { marginTop: 20 },
  episodeList: { paddingBottom: 24 },
  episodeRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  episodeThumb: { width: 110, aspectRatio: 16 / 9, borderRadius: 6, backgroundColor: colors.bg },
  episodeThumbFallback: { borderWidth: 1, borderColor: colors.border },
  episodeInfo: { flex: 1, justifyContent: 'center' },
  episodeTitle: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  episodeOverview: { color: colors.muted, fontSize: 12, lineHeight: 16 },
});
