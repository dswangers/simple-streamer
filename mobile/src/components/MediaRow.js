import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import MediaCard from './MediaCard';

export default function MediaRow({ title, items, onPress, onRemove, onShowEpisodes, subtitleFor }) {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            onPress={onPress}
            onRemove={onRemove}
            onShowEpisodes={onShowEpisodes}
            subtitleFor={subtitleFor}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10, paddingHorizontal: 16 },
  list: { paddingHorizontal: 16, gap: 12 },
});
