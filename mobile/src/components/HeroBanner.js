import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

export default function HeroBanner({ item, onPlay }) {
  if (!item) return null;

  return (
    <ImageBackground source={{ uri: item.backdrop || item.poster }} style={styles.wrap}>
      <LinearGradient colors={['transparent', 'rgba(15,17,21,0.5)', colors.bg]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.overview ? (
          <Text style={styles.overview} numberOfLines={2}>
            {item.overview}
          </Text>
        ) : null}
        <Pressable style={styles.playBtn} onPress={() => onPlay(item)}>
          <Text style={styles.playBtnText}>▶ Play</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 16 / 9, justifyContent: 'flex-end', backgroundColor: colors.panel },
  content: { padding: 16, paddingBottom: 22 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  overview: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  playBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
