import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';

import { fetchDetails, fetchSeason, fetchSimilar, posterUrl, profileUrl } from '../api/tmdb';
import { fetchRatings } from '../api/omdb';
import {
  addFavorite,
  getContinueWatchingItem,
  getFavorite,
  removeContinueWatching,
  removeFavorite,
  saveProgress,
} from '../api/backend';
import { EMBED_BASE } from '../config';
import { colors } from '../theme';
import MediaRow from '../components/MediaRow';

function rottenTomatoesColor(value) {
  const pct = parseInt(value, 10);
  return pct >= 60 ? '#3ecf5b' : '#e5484d';
}

function metascoreColor(value) {
  const score = parseInt(value, 10);
  if (score >= 61) return '#3ecf5b';
  if (score >= 40) return '#f5c518';
  return '#e5484d';
}

function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Relays the embed's window.postMessage PLAYER_EVENT calls out of the
// WebView — react-native-webview only surfaces messages sent through
// window.ReactNativeWebView.postMessage, not arbitrary postMessage.
const RELAY_SCRIPT = `
  (function () {
    window.addEventListener('message', function (event) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
      } catch (e) {}
    });
    true;
  })();
`;

function isResumable(resume) {
  if (!resume) return false;
  const nearlyDone = resume.duration > 0 && resume.progress / resume.duration > 0.95;
  return resume.progress > 10 && !nearlyDone;
}

export default function PlayerScreen({ route, navigation }) {
  const { type, id } = route.params;
  const [status, setStatus] = useState('Loading...');
  const [tmdbData, setTmdbData] = useState(null);
  const [resume, setResume] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);

  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [ratings, setRatings] = useState(null);

  useEffect(() => {
    ScreenOrientation.unlockAsync();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [data, resumeItem, favorite, similarItems] = await Promise.all([
          fetchDetails(type, id),
          getContinueWatchingItem(type, id).catch(() => null),
          getFavorite(type, id).catch(() => null),
          fetchSimilar(type, id).catch(() => []),
        ]);
        if (cancelled) return;

        navigation.setOptions({ title: data.title || data.name || 'Untitled' });
        setTmdbData(data);
        setResume(resumeItem);
        setIsFavorite(Boolean(favorite));
        setSimilar(similarItems);
        setStatus('');

        // Not part of the Promise.all above — needs data.external_ids first,
        // and shouldn't block the rest of the screen if OMDb is slow/unset.
        setRatings(null);
        fetchRatings(data.external_ids?.imdb_id).then((r) => {
          if (!cancelled) setRatings(r);
        });

        if (type === 'tv') {
          const realSeasons = (data.seasons || []).filter((s) => s.episode_count > 0);
          setSeasons(realSeasons);
          // An explicit season/episode in route params (from the season/episode
          // picker on Home) wins over whatever Continue Watching last saved.
          const defaultSeason = route.params.season || resumeItem?.season || realSeasons[0]?.season_number || 1;
          setSelectedSeason(defaultSeason);
          setSelectedEpisode(
            route.params.episode || (resumeItem?.season === defaultSeason ? resumeItem.episode : 1)
          );
        }
      } catch (err) {
        if (!cancelled) setStatus(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [type, id, navigation]);

  useEffect(() => {
    if (type !== 'tv' || !selectedSeason) return;
    let cancelled = false;
    setEpisodesLoading(true);
    fetchSeason(id, selectedSeason)
      .then((data) => {
        if (!cancelled) setEpisodes(data.episodes || []);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      })
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, id, selectedSeason]);

  const embedSrc = useMemo(() => {
    if (!tmdbData) return null;

    if (type === 'movie') {
      const base = `${EMBED_BASE}/embed/movie/${id}`;
      const startAt = isResumable(resume) ? Math.floor(resume.progress) : null;
      return startAt ? `${base}?startAt=${startAt}` : base;
    }

    if (!selectedSeason || !selectedEpisode) return null;
    const base = `${EMBED_BASE}/embed/tv/${id}/${selectedSeason}/${selectedEpisode}`;
    const matchesResume = resume && resume.season === selectedSeason && resume.episode === selectedEpisode;
    const startAt = matchesResume && isResumable(resume) ? Math.floor(resume.progress) : null;
    return startAt ? `${base}?startAt=${startAt}` : base;
  }, [tmdbData, type, id, resume, selectedSeason, selectedEpisode]);

  function selectSeason(seasonNumber) {
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(resume?.season === seasonNumber ? resume.episode : 1);
  }

  function handleMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (!payload || payload.type !== 'PLAYER_EVENT') return;

    const { player_info, player_status, player_progress, player_duration } = payload.data || {};
    if (!tmdbData) return;

    if (player_status === 'completed') {
      removeContinueWatching(type, id).catch(() => {});
      return;
    }

    if ((player_status === 'playing' || player_status === 'paused' || player_status === 'seeked') && player_duration) {
      saveProgress({
        mediaType: type,
        tmdbId: id,
        imdbId: player_info?.imdb || tmdbData.external_ids?.imdb_id || null,
        title: tmdbData.title || tmdbData.name || 'Untitled',
        posterPath: tmdbData.poster_path || null,
        season: player_info?.season ?? selectedSeason ?? null,
        episode: player_info?.episode ?? selectedEpisode ?? null,
        progress: player_progress,
        duration: player_duration,
      }).catch(() => {});
    }
  }

  async function toggleFavorite() {
    if (!tmdbData) return;
    try {
      if (isFavorite) {
        await removeFavorite(type, id);
      } else {
        await addFavorite({
          mediaType: type,
          tmdbId: id,
          imdbId: tmdbData.external_ids?.imdb_id || null,
          title: tmdbData.title || tmdbData.name || 'Untitled',
          posterPath: tmdbData.poster_path || null,
        });
      }
      setIsFavorite(!isFavorite);
    } catch (err) {
      setStatus(err.message);
    }
  }

  const year = tmdbData ? (tmdbData.release_date || tmdbData.first_air_date || '').slice(0, 4) : '';
  const runtimeLabel = tmdbData
    ? formatRuntime(type === 'movie' ? tmdbData.runtime : tmdbData.episode_run_time?.[0])
    : null;
  const genreLabel = tmdbData ? (tmdbData.genres || []).map((g) => g.name).join(' · ') : '';
  const metaLine = [year, runtimeLabel, genreLabel].filter(Boolean).join('  ·  ');
  const cast = tmdbData?.credits?.cast?.slice(0, 12) || [];

  const header = (
    <View>
      <View style={styles.playerWrap}>
        {embedSrc ? (
          <WebView
            source={{ uri: embedSrc }}
            style={styles.webview}
            onMessage={handleMessage}
            injectedJavaScript={RELAY_SCRIPT}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            domStorageEnabled
            // Swallows the embed's ad popup (window.open()/target=_blank) without
            // touching normal in-page navigation — unlike onShouldStartLoadWithRequest,
            // this doesn't risk blocking a legitimate nested player/CDN frame.
            onOpenWindow={() => {}}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {tmdbData ? (
          <>
            <Text style={styles.detailTitle}>{tmdbData.title || tmdbData.name}</Text>
            {metaLine ? <Text style={styles.detailMeta}>{metaLine}</Text> : null}
            {ratings && (ratings.imdb || ratings.rottenTomatoes || ratings.metascore) ? (
              <View style={styles.ratingsRow}>
                {ratings.imdb ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeLabel}>IMDb</Text>
                    <Text style={styles.ratingBadgeValue}>{ratings.imdb}</Text>
                  </View>
                ) : null}
                {ratings.rottenTomatoes ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeLabel}>RT</Text>
                    <Text style={[styles.ratingBadgeValue, { color: rottenTomatoesColor(ratings.rottenTomatoes) }]}>
                      {ratings.rottenTomatoes}
                    </Text>
                  </View>
                ) : null}
                {ratings.metascore ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeLabel}>Metascore</Text>
                    <Text style={[styles.ratingBadgeValue, { color: metascoreColor(ratings.metascore) }]}>
                      {ratings.metascore}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
        <Pressable
          style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
          onPress={toggleFavorite}
          disabled={!embedSrc}
        >
          <Text style={[styles.favoriteBtnText, isFavorite && styles.favoriteBtnTextActive]}>
            {isFavorite ? '★ Favorited' : '☆ Add to Favorites'}
          </Text>
        </Pressable>
        {tmdbData?.overview ? <Text style={styles.detailOverview}>{tmdbData.overview}</Text> : null}
      </View>

      {type === 'tv' ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonRow}>
            {seasons.map((s) => {
              const active = s.season_number === selectedSeason;
              return (
                <Pressable
                  key={s.season_number}
                  style={[styles.seasonChip, active && styles.seasonChipActive]}
                  onPress={() => selectSeason(s.season_number)}
                >
                  <Text style={[styles.seasonChipText, active && styles.seasonChipTextActive]}>
                    {s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {episodesLoading ? <ActivityIndicator color={colors.accent} style={styles.episodesLoading} /> : null}
        </View>
      ) : null}

      {cast.length > 0 ? (
        <View style={styles.castSection}>
          <Text style={styles.sectionHeading}>Cast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castList}>
            {cast.map((person) => (
              <Pressable
                key={person.id}
                style={styles.castCard}
                onPress={() => navigation.navigate('Person', { personId: person.id, name: person.name })}
              >
                {person.profile_path ? (
                  <Image source={{ uri: profileUrl(person.profile_path) }} style={styles.castPhoto} />
                ) : (
                  <View style={[styles.castPhoto, styles.castPhotoFallback]}>
                    <Text style={styles.castInitial}>{person.name?.[0] || '?'}</Text>
                  </View>
                )}
                <Text style={styles.castName} numberOfLines={1}>
                  {person.name}
                </Text>
                <Text style={styles.castCharacter} numberOfLines={1}>
                  {person.character}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  const footer = (
    <MediaRow
      title="More Like This"
      items={similar}
      onPress={(item) => navigation.push('Player', { type: item.type, id: item.id })}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={type === 'tv' ? episodes : []}
        keyExtractor={(item) => String(item.episode_number)}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item }) => {
          const active = item.episode_number === selectedEpisode;
          return (
            <Pressable
              style={[styles.episodeRow, active && styles.episodeRowActive]}
              onPress={() => setSelectedEpisode(item.episode_number)}
            >
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
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  playerWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, gap: 12 },
  status: { color: colors.muted, fontSize: 13 },
  detailTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  detailMeta: { color: colors.muted, fontSize: 13 },
  detailOverview: { color: colors.text, fontSize: 14, lineHeight: 20 },
  ratingsRow: { flexDirection: 'row', gap: 16 },
  ratingBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  ratingBadgeLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  ratingBadgeValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  favoriteBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  favoriteBtnActive: { borderColor: colors.accent },
  favoriteBtnText: { color: colors.text, fontSize: 14 },
  favoriteBtnTextActive: { color: colors.accent },
  seasonRow: { paddingLeft: 16, marginBottom: 12 },
  seasonChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  seasonChipActive: { borderColor: colors.accent, backgroundColor: colors.panel },
  seasonChipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  seasonChipTextActive: { color: colors.accent },
  episodesLoading: { marginBottom: 12 },
  episodeRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  episodeRowActive: { backgroundColor: colors.panel },
  episodeThumb: { width: 120, aspectRatio: 16 / 9, borderRadius: 6, backgroundColor: colors.panel },
  episodeThumbFallback: { borderWidth: 1, borderColor: colors.border },
  episodeInfo: { flex: 1, justifyContent: 'center' },
  episodeTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  episodeOverview: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  sectionHeading: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10, paddingHorizontal: 16 },
  castSection: { marginBottom: 28 },
  castList: { paddingHorizontal: 16, gap: 14 },
  castCard: { width: 84 },
  castPhoto: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.panel },
  castPhotoFallback: { borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  castInitial: { color: colors.muted, fontSize: 24, fontWeight: '700' },
  castName: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  castCharacter: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
