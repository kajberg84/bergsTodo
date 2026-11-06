import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Todo = { id: string; text: string; createdAt: string };
type VoiceAction = 'add' | 'remove' | null;
const STORAGE_KEY = '@bergs-todo/items';

const SWEDISH_NUMBERS: Record<string, number> = {
  en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5,
  sex: 6, sju: 7, åtta: 8, nio: 9, tio: 10,
  elva: 11, tolv: 12, tretton: 13, fjorton: 14, femton: 15,
  sexton: 16, sjutton: 17, arton: 18, nitton: 19, tjugo: 20,
};

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

function afterPrefix(transcript: string, prefixes: string[]) {
  const value = normalize(transcript);
  const prefix = prefixes.find((item) => value === item || value.startsWith(`${item} `));
  return prefix ? value.slice(prefix.length).trim() : undefined;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [pendingAction, setPendingAction] = useState<VoiceAction>(null);
  const [voiceMessage, setVoiceMessage] = useState('Tryck på mikrofonen och säg “lägg till köp mjölk”.');
  const hasLoaded = useRef(false);

  useEffect(() => {
    async function loadTodos() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setTodos(JSON.parse(saved) as Todo[]);
      } catch {
        setVoiceMessage('De sparade uppgifterna kunde inte läsas in.');
      } finally {
        hasLoaded.current = true;
        setIsLoading(false);
      }
    }
    void loadTodos();
  }, []);

  useEffect(() => {
    if (hasLoaded.current) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  function addTodo(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;
    setTodos((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: cleanText, createdAt: new Date().toISOString() }, ...current]);
    setDraft('');
  }

  function removeTodo(id: string) {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }

  function removeByVoice(spokenText: string) {
    const target = normalize(spokenText);
    const numberMatch = target.match(/^nummer\s+(.+)$/);
    if (numberMatch) {
      const spokenNumber = numberMatch[1];
      const number = spokenNumber ? Number.parseInt(spokenNumber, 10) || SWEDISH_NUMBERS[spokenNumber] : undefined;
      const numberedTodo = number ? todos[number - 1] : undefined;
      if (!numberedTodo) {
        setVoiceMessage(`Jag hittar ingen uppgift med nummer ${spokenNumber ?? ''}.`);
        return;
      }
      removeTodo(numberedTodo.id);
      setVoiceMessage(`Tog bort nummer ${number}: ${numberedTodo.text}`);
      return;
    }
    const exact = todos.filter((todo) => normalize(todo.text) === target);
    const partial = todos.filter((todo) => normalize(todo.text).includes(target));
    const match = exact.length === 1 ? exact[0] : partial.length === 1 ? partial[0] : undefined;
    if (!match) {
      setVoiceMessage(partial.length > 1 ? `Flera uppgifter matchar ”${spokenText}”. Ta bort den manuellt.` : `Jag kunde inte hitta ”${spokenText}”.`);
      return;
    }
    removeTodo(match.id);
    setVoiceMessage(`Tog bort: ${match.text}`);
  }

  function handleTranscript(transcript: string) {
    const spoken = transcript.trim();
    if (!spoken) return setVoiceMessage('Jag hörde ingenting. Försök igen.');
    if (pendingAction === 'add') {
      addTodo(spoken); setPendingAction(null); setVoiceMessage(`Lade till: ${spoken}`); return;
    }
    if (pendingAction === 'remove') {
      setPendingAction(null); removeByVoice(spoken); return;
    }
    const addText = afterPrefix(spoken, ['lägg till']);
    if (addText !== undefined) {
      if (addText) { addTodo(addText); setVoiceMessage(`Lade till: ${addText}`); }
      else { setPendingAction('add'); setVoiceMessage('Vad ska jag lägga till? Tryck på mikrofonen och säg det.'); }
      return;
    }
    const removeText = afterPrefix(spoken, ['ta bort']);
    if (removeText !== undefined) {
      if (removeText) removeByVoice(removeText);
      else { setPendingAction('remove'); setVoiceMessage('Vad ska jag ta bort? Tryck på mikrofonen och säg det.'); }
      return;
    }
    setVoiceMessage(`Jag hörde “${spoken}”. Börja med “lägg till” eller “ta bort”.`);
  }

  useSpeechRecognitionEvent('start', () => { setIsListening(true); setVoiceMessage('Lyssnar…'); });
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (event.isFinal && transcript) handleTranscript(transcript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    setVoiceMessage(event.error === 'no-speech' ? 'Jag hörde ingenting. Försök igen.' : `Taligenkänningen misslyckades: ${event.message || event.error}`);
  });

  async function toggleListening() {
    if (isListening) return ExpoSpeechRecognitionModule.stop();
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) return setVoiceMessage('Appen behöver tillgång till mikrofon och taligenkänning.');
    ExpoSpeechRecognitionModule.start({ lang: 'sv-SE', interimResults: false, continuous: false });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>BERGS TODO</Text><Text style={styles.title}>Vad behöver göras?</Text></View>
          <View style={styles.countBadge}><Text style={styles.count}>{todos.length}</Text></View>
        </View>

        <View style={styles.voiceCard}>
          <Pressable accessibilityLabel={isListening ? 'Sluta lyssna' : 'Börja lyssna'} accessibilityRole="button" onPress={() => void toggleListening()} style={({ pressed }) => [styles.micButton, isListening && styles.micButtonListening, pressed && styles.pressed]}>
            <Text style={styles.micIcon}>{isListening ? '■' : '●'}</Text>
          </Pressable>
          <View style={styles.voiceCopy}><Text style={styles.voiceTitle}>{isListening ? 'Lyssnar' : 'Röstkommando'}</Text><Text style={styles.voiceMessage}>{voiceMessage}</Text></View>
        </View>

        <View style={styles.composer}>
          <TextInput onChangeText={setDraft} onSubmitEditing={() => addTodo(draft)} placeholder="Lägg till en uppgift manuellt…" placeholderTextColor="#7C8D87" returnKeyType="done" style={styles.input} value={draft} />
          <Pressable accessibilityLabel="Lägg till uppgift" accessibilityRole="button" disabled={!draft.trim()} onPress={() => addTodo(draft)} style={({ pressed }) => [styles.addButton, !draft.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.addButtonText}>＋</Text></Pressable>
        </View>

        {isLoading ? <ActivityIndicator color="#173F35" style={styles.loader} /> : (
          <ScrollView contentContainerStyle={todos.length ? styles.list : styles.emptyList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {todos.length === 0 ? (
              <View style={styles.emptyState}><Text style={styles.emptyTitle}>Inget här ännu</Text><Text style={styles.emptyText}>Lägg till något ovan eller tryck på mikrofonen och säg{`\n`}“lägg till köp mjölk”.</Text></View>
            ) : todos.map((todo, index) => (
              <View key={todo.id} style={styles.todoRow}>
                <View style={styles.todoNumber}><Text style={styles.todoNumberText}>{index + 1}</Text></View><Text style={styles.todoText}>{todo.text}</Text>
                <Pressable accessibilityLabel={`Ta bort ${todo.text}`} accessibilityRole="button" hitSlop={10} onPress={() => removeTodo(todo.id)} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><Text style={styles.removeText}>×</Text></Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#173F35', flex: 1 }, screen: { backgroundColor: '#F2F4EF', flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#173F35', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 28, paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 42 : 18 },
  eyebrow: { color: '#D8F36A', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }, title: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  countBadge: { alignItems: 'center', backgroundColor: '#28584B', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 }, count: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  voiceCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, elevation: 3, flexDirection: 'row', marginHorizontal: 18, marginTop: -12, padding: 16, shadowColor: '#173F35', shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.1, shadowRadius: 12 },
  micButton: { alignItems: 'center', backgroundColor: '#D8F36A', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 }, micButtonListening: { backgroundColor: '#FF806E' }, micIcon: { color: '#173F35', fontSize: 20, fontWeight: '900' },
  voiceCopy: { flex: 1, marginLeft: 14 }, voiceTitle: { color: '#173F35', fontSize: 16, fontWeight: '800' }, voiceMessage: { color: '#64746F', fontSize: 13, lineHeight: 18, marginTop: 3 },
  composer: { flexDirection: 'row', marginHorizontal: 18, marginTop: 20 }, input: { backgroundColor: '#FFF', borderColor: '#DDE3DD', borderRadius: 16, borderWidth: 1, color: '#173F35', flex: 1, fontSize: 16, paddingHorizontal: 16 },
  addButton: { alignItems: 'center', backgroundColor: '#173F35', borderRadius: 16, height: 54, justifyContent: 'center', marginLeft: 10, width: 54 }, disabled: { opacity: 0.35 }, addButtonText: { color: '#FFF', fontSize: 28, lineHeight: 30 },
  loader: { marginTop: 60 }, list: { padding: 18, paddingBottom: 40 }, emptyList: { flexGrow: 1, justifyContent: 'center', padding: 30 }, emptyState: { alignItems: 'center', marginBottom: 80 }, emptyTitle: { color: '#173F35', fontSize: 20, fontWeight: '800' }, emptyText: { color: '#74817D', fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  todoRow: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#E1E6E1', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 10, minHeight: 64, padding: 14 }, todoNumber: { alignItems: 'center', backgroundColor: '#D8F36A', borderRadius: 14, height: 28, justifyContent: 'center', marginRight: 12, minWidth: 28, paddingHorizontal: 6 }, todoNumberText: { color: '#173F35', fontSize: 13, fontWeight: '900' }, todoText: { color: '#263D36', flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  removeButton: { alignItems: 'center', height: 36, justifyContent: 'center', marginLeft: 8, width: 36 }, removeText: { color: '#8A9793', fontSize: 28, lineHeight: 30 }, pressed: { opacity: 0.65 },
});
