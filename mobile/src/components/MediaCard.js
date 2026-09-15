import { useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export const CARD_WIDTH = 130;

export default function MediaCard({ item, onPress, onRemove, onShowEpisodes, subtitleFor }) {
  const [holding, setHolding] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const longPressedRef = useRef(false);

  function handlePressIn() {
    longPressedRef.current = false;
  }

  function handleLongPress() {
    longPressedRef.current = true;
    setHolding(true);
    Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, friction: 6 }).start();
  }

  function handlePress() {
    // Releasing a long-press also fires onPress in RN's Pressable — swallow
    // that so letting go of a held-for-preview card doesn't also navigate.
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    onPress(item);
  }

  function release() {
    if (!holding) return;
    setHolding(false);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }

  const progressPct = item.duration ? Math.min(100, (item.progress / item.duration) * 100) : 0;
  const subtitle = subtitleFor ? subtitleFor(item) : null;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressOut={release}
      delayLongPress={280}
      style={styles.wrap}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }, holding && styles.cardHolding]}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]} />
        )}

        {progressPct > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        ) : null}

        {onRemove ? (
          <Pressable
            style={styles.removeBtn}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation?.();
              onRemove(item);
            }}
          >
            <Text style={styles.badgeText}>×</Text>
          </Pressable>
        ) : null}

        {onShowEpisodes && item.type === 'tv' ? (
          <Pressable
            style={styles.episodesBtn}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation?.();
              onShowEpisodes(item);
            }}
          >
            <Text style={styles.badgeText}>☰</Text>
          </Pressable>
        ) : null}

        {holding ? (
          <View style={styles.infoOverlay}>
            <Text style={styles.infoTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.year ? (
              <Text style={styles.infoMeta}>
                {item.year} · {item.type === 'tv' ? 'TV' : 'Movie'}
              </Text>
            ) : null}
            {item.overview ? (
              <Text style={styles.infoOverview} numberOfLines={5}>
                {item.overview}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      {subtitle ? (
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: CARD_WIDTH },
  card: {
    width: CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  cardHolding: {
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  poster: { width: '100%', height: '100%' },
  posterFallback: { borderWidth: 1, borderColor: colors.border },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodesBtn: {
    position: 'absolute',
    bottom: 8,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.text, fontSize: 13, lineHeight: 15 },
  infoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,11,14,0.9)',
    padding: 10,
    justifyContent: 'flex-end',
  },
  infoTitle: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoMeta: { color: colors.accent, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  infoOverview: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  cardTitle: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
  cardSubtitle: { color: colors.muted, fontSize: 11, marginTop: 1 },
});
