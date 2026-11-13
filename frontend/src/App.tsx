import { useEffect, useState } from 'react';
import {
  Container,
  Stack,
  Alert,
  Group,
  Button,
  Tabs,
  Text,
  Badge,
  Box,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconSparkles,
  IconDashboard,
  IconServer,
} from '@tabler/icons-react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { StationBoard } from './components/StationBoard';
import { Leaderboard } from './components/Leaderboard';
import { BackendExplorer } from './components/BackendExplorer';
import { useTransitStore } from './stores/useTransitStore';

export default function App() {
  const {
    isConnected,
    isDemoMode,
    backendUrl,
    fetchDashboardData,
    toggleDemoMode,
  } = useTransitStore();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('dashboard');

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Periodic refresh (30s matching TransLink GTFS-RT feed update cycle)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  return (
    <Box style={{ minHeight: '100vh', backgroundColor: '#0b1118', color: '#f1f5f9' }}>
      {/* Top Header */}
      <Header autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} />

      <Container size="xl" py="lg">
        <Stack gap="lg">
          {/* Backend Connection Alert if Offline */}
          {!isConnected && !isDemoMode && (
            <Alert
              icon={<IconAlertCircle size={20} />}
              title="FastAPI Backend Not Detected"
              color="yellow"
              variant="filled"
              radius="md"
            >
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text size="sm">
                    Unable to reach the backend at <code>{backendUrl}</code>. Run the following command in your terminal to start it:
                  </Text>
                  <Text size="xs" ff="monospace" mt={4} fw={700}>
                    backend/venv/bin/uvicorn backend.main:app --port 8000 --reload
                  </Text>
                </div>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="white"
                    color="dark"
                    leftSection={<IconSparkles size={14} />}
                    onClick={() => toggleDemoMode(true)}
                  >
                    Enable Demo Mode
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    color="white"
                    onClick={() => fetchDashboardData()}
                  >
                    Retry Connection
                  </Button>
                </Group>
              </Group>
            </Alert>
          )}

          {/* Navigation Tabs */}
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            variant="pills"
            color="cyan"
            styles={{
              tab: {
                backgroundColor: '#131e2b',
                color: '#94a3b8',
                border: '1px solid #1e2e3d',
                fontWeight: 600,
              },
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="dashboard" leftSection={<IconDashboard size={16} />}>
                Live Transit Dashboard
              </Tabs.Tab>
              <Tabs.Tab value="explorer" leftSection={<IconServer size={16} />}>
                Backend API Explorer
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="dashboard" pt="md">
              <Stack gap="lg">
                {/* 1. Realtime Telemetry Metric Cards */}
                <MetricCards />

                {/* 2. Station Arrivals Board */}
                <StationBoard />

                {/* 3. Reliability Leaderboard */}
                <Leaderboard />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="explorer" pt="md">
              <Stack gap="lg">
                <BackendExplorer />
              </Stack>
            </Tabs.Panel>
          </Tabs>

          {/* Footer Info */}
          <Group justify="space-between" align="center" mt="xl" pt="md" style={{ borderTop: '1px solid #1e2e3d' }}>
            <Text size="xs" c="dimmed">
              TransLink Vancouver Open Data GTFS Realtime • FastAPI & React Mantine Telemetry
            </Text>
            <Group gap="xs">
              <Badge size="xs" variant="outline" color="gray">
                FastAPI v0.115+
              </Badge>
              <Badge size="xs" variant="outline" color="cyan">
                React 19 & Mantine 9
              </Badge>
            </Group>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
