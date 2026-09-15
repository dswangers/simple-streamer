import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import { fetchPopular, fetchRecommendations, fetchTrending, posterUrl } from '../api/tmdb';
import { getContinueWatching, getFavorites, removeContinueWatching, removeFavorite } from '../api/backend';
import { colors } from '../theme';
import HeroBanner from '../components/HeroBanner';
import MediaRow from '../components/MediaRow';
import SeasonEpisodePicker from '../components/SeasonEpisodePicker';

function mapContinueWatchingRow(row) {
  return {
    id: row.tmdb_id,
    type: row.media_type,
    title: row.title,
    poster: posterUrl(row.poster_path),
    progress: row.progress,
    duration: row.duration,
    season: row.season,
    episode: row.episode,
  };
}

function mapFavoriteRow(row) {
  return {
    id: row.tmdb_id,
    type: row.media_type,
    title: row.title,
    poster: posterUrl(row.poster_path),
  };
}

function continueWatchingSubtitle(item) {
  return item.type === 'tv' && item.season && item.episode ? `S${item.season} E${item.episode}` : null;
}

export default function HomeScreen({ navigation }) {
  const [continueWatching, setContinueWatching] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [trending, setTrending] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularTv, setPopularTv] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [picker, setPicker] = useState(null);

  const openPlayer = (item, extra) => navigation.navigate('Player', { type: item.type, id: item.id, ...extra });

  const loadRows = useCallback(async () => {
    try {
      setContinueWatching((await getContinueWatching()).map(mapContinueWatchingRow));
    } catch {
      setContinueWatching([]);
    }
    try {
      setFavorites((await getFavorites()).map(mapFavoriteRow));
    } catch {
      setFavorites([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRows();
    }, [loadRows])
  );

  useEffect(() => {
    fetchTrending().then(setTrending).catch(() => setTrending([]));
    fetchPopular('movie').then(setPopularMovies).catch(() => setPopularMovies([]));
    fetchPopular('tv').then(setPopularTv).catch(() => setPopularTv([]));
  }, []);

  // "Recommended For You": seed TMDB's /recommendations off whatever the
  // user is actually watching or has favorited, merge, and dedupe against
  // itself and the seeds. Keyed on the seed ids (not the arrays themselves)
  // so it doesn't refetch every time Home regains focus with unchanged data.
  const seeds = [...continueWatching, ...favorites].slice(0, 5);
  const seedKey = seeds.map((item) => `${item.type}-${item.id}`).join(',');

  useEffect(() => {
    if (seeds.length === 0) {
      setRecommended([]);
      return;
    }
    let cancelled = false;
    const seen = new Set(seeds.map((item) => `${item.type}-${item.id}`));
    Promise.all(seeds.map((item) => fetchRecommendations(item.type, item.id).catch(() => []))).then((lists) => {
      if (cancelled) return;
      const merged = [];
      for (const list of lists) {
        for (const item of list) {
          const key = `${item.type}-${item.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(item);
        }
      }
      merged.sort((a, b) => b.popularity - a.popularity);
      setRecommended(merged.slice(0, 20));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const heroItem = trending[0] || popularMovies[0] || null;

  function showEpisodePicker(item) {
    setPicker({ id: item.id, title: item.title });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>simple-streamer</Text>
          <Pressable onPress={() => navigation.navigate('Search')} hitSlop={10}>
            <Text style={styles.searchIcon}>🔍</Text>
          </Pressable>
        </View>

        <HeroBanner item={heroItem} onPlay={openPlayer} />

        <View style={styles.rows}>
          <MediaRow
            title="Continue Watching"
            items={continueWatching}
            onPress={openPlayer}
            onRemove={(item) => removeContinueWatching(item.type, item.id).then(loadRows)}
            onShowEpisodes={showEpisodePicker}
            subtitleFor={continueWatchingSubtitle}
          />
          <MediaRow
            title="Favorites"
            items={favorites}
            onPress={openPlayer}
            onRemove={(item) => removeFavorite(item.type, item.id).then(loadRows)}
            onShowEpisodes={showEpisodePicker}
          />
          <MediaRow
            title="Recommended For You"
            items={recommended}
            onPress={openPlayer}
            onShowEpisodes={showEpisodePicker}
          />
          <MediaRow title="Trending Now" items={trending} onPress={openPlayer} onShowEpisodes={showEpisodePicker} />
          <MediaRow title="Popular Movies" items={popularMovies} onPress={openPlayer} />
          <MediaRow title="Popular TV Shows" items={popularTv} onPress={openPlayer} onShowEpisodes={showEpisodePicker} />
        </View>
      </ScrollView>

      <SeasonEpisodePicker
        visible={Boolean(picker)}
        tvId={picker?.id}
        title={picker?.title}
        onClose={() => setPicker(null)}
        onSelect={(season, episode) => {
          const id = picker.id;
          setPicker(null);
          navigation.navigate('Player', { type: 'tv', id, season, episode });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  appTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  searchIcon: { fontSize: 20 },
  rows: { paddingTop: 20 },
});
