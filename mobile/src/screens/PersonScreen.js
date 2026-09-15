import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPerson, fetchPersonCredits, profileUrl } from '../api/tmdb';
import { colors } from '../theme';

export default function PersonScreen({ route, navigation }) {
  const { personId, name } = route.params;
  const [person, setPerson] = useState(null);
  const [credits, setCredits] = useState([]);
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    let cancelled = false;
    navigation.setOptions({ title: name || 'Actor' });

    Promise.all([fetchPerson(personId), fetchPersonCredits(personId)])
      .then(([personData, creditsData]) => {
        if (cancelled) return;
        setPerson(personData);
        navigation.setOptions({ title: personData.name || name || 'Actor' });
        setCredits(creditsData);
        setStatus(creditsData.length ? '' : 'No credits found');
      })
      .catch((err) => {
        if (!cancelled) setStatus(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [personId, name, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={credits}
        numColumns={3}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.gridContent}
        ListHeaderComponent={
          <View style={styles.header}>
            {person?.profile_path ? (
              <Image source={{ uri: profileUrl(person.profile_path) }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoFallback]} />
            )}
            <Text style={styles.name}>{person?.name || name}</Text>
            {status ? <Text style={styles.status}>{status}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.gridCard}
            onPress={() => navigation.navigate('Player', { type: item.type, id: item.id })}
          >
            {item.poster ? (
              <Image source={{ uri: item.poster }} style={styles.gridPoster} />
            ) : (
              <View style={[styles.gridPoster, styles.gridPosterFallback]} />
            )}
            <Text style={styles.gridTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.gridSubtitle} numberOfLines={1}>
              {item.year || ''} · {item.type}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', paddingVertical: 24 },
  photo: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.panel },
  photoFallback: { borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 12 },
  status: { color: colors.muted, fontSize: 13, marginTop: 8 },
  gridContent: { paddingHorizontal: 12, paddingBottom: 24 },
  gridCard: { flex: 1 / 3, padding: 4 },
  gridPoster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: colors.panel },
  gridPosterFallback: { borderWidth: 1, borderColor: colors.border },
  gridTitle: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
  gridSubtitle: { color: colors.muted, fontSize: 11 },
});
