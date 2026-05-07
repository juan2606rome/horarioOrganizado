import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { TEAM_MEMBERS } from '../data/teamMembers';
import CombinedScreen from '../screens/CombinedScreen';
import MemberCalendarScreen from '../screens/MemberCalendarScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Tab = {
  id: string;
  label: string;
  type: 'member' | 'combined';
};

const TABS: Tab[] = [
  { id: 'combined', label: 'Horario\nCombinado', type: 'combined' },
  ...TEAM_MEMBERS.map((m) => ({
    id: m.id,
    label: m.name,
    type: 'member' as const,
  })),
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('combined');
  const tabScrollRef = useRef<ScrollView>(null);

  const activeMember = TEAM_MEMBERS.find((m) => m.id === activeTab) || null;
  const activeTabObj = TABS.find((t) => t.id === activeTab);

  const handleTabPress = (tabId: string, index: number) => {
    setActiveTab(tabId);
    // Scroll tab bar to keep selected tab visible
    tabScrollRef.current?.scrollTo({
      x: Math.max(0, index * 90 - SCREEN_WIDTH / 2 + 45),
      animated: true,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />

      {/* ── App Header ── */}
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>📅</Text>
          </View>
          <View>
            <Text style={styles.appTitle}>Calendario Equipo</Text>
            <Text style={styles.appSubtitle}>Social · 2026</Text>
          </View>
        </View>
        {activeMember && (
          <View style={[styles.activeMemberBadge, { backgroundColor: activeMember.color }]}>
            <Text style={styles.activeMemberInitials}>{activeMember.initials}</Text>
          </View>
        )}
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
          bounces={false}
        >
          {TABS.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const member = TEAM_MEMBERS.find((m) => m.id === tab.id);
            const accentColor = member?.color || '#2563EB';

            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  isActive && styles.tabActive,
                  isActive && { borderBottomColor: accentColor },
                ]}
                onPress={() => handleTabPress(tab.id, index)}
                activeOpacity={0.7}
              >
                {tab.type === 'combined' ? (
                  <Text style={styles.tabIcon}>🗓</Text>
                ) : (
                  <View
                    style={[
                      styles.tabAvatar,
                      { backgroundColor: isActive ? accentColor : '#E5E7EB' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabAvatarText,
                        { color: isActive ? '#FFF' : '#6B7280' },
                      ]}
                    >
                      {member?.initials}
                    </Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && { color: accentColor, fontWeight: '700' },
                  ]}
                  numberOfLines={2}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Screen content ── */}
      <View style={styles.screenContainer}>
        {activeTab === 'combined' ? (
          <CombinedScreen />
        ) : activeMember ? (
          <MemberCalendarScreen member={activeMember} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
  appHeader: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 22,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '500',
    marginTop: 1,
  },
  activeMemberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activeMemberInitials: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 4,
  },
  tabBar: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    borderRadius: 4,
    gap: 5,
  },
  tabActive: {
    borderBottomColor: '#2563EB',
    backgroundColor: '#F8FAFF',
  },
  tabAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 15,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
});
