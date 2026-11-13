import { useState } from 'react';
import {
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Switch,
  Paper,
  Box,
} from '@mantine/core';
import {
  IconBus,
  IconRefresh,
  IconWifi,
  IconWifiOff,
  IconAdjustmentsHorizontal,
  IconSparkles,
} from '@tabler/icons-react';
import { useTransitStore } from '../stores/useTransitStore';

interface HeaderProps {
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
}

export function Header({ autoRefresh, setAutoRefresh }: HeaderProps) {
  const {
    isConnected,
    isDemoMode,
    isLoading,
    lastUpdated,
    backendUrl,
    setBackendUrl,
    fetchDashboardData,
    toggleDemoMode,
  } = useTransitStore();

  const [modalOpened, setModalOpened] = useState(false);
  const [urlInput, setUrlInput] = useState(backendUrl);

  const handleSaveUrl = () => {
    setBackendUrl(urlInput);
    setModalOpened(false);
  };

  return (
    <>
      <Paper
        p="md"
        radius={0}
        style={{
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          {/* Logo and title */}
          <Group gap="sm">
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(2, 132, 199, 0.4)',
              }}
            >
              <IconBus size={24} color="#ffffff" />
            </Box>
            <div>
              <Group gap="xs" align="center">
                <Text fw={700} size="lg" c="#ffffff">
                  Vancouver Transit Dashboard
                </Text>
                <Badge
                  variant="filled"
                  color={isDemoMode ? 'violet' : isConnected ? 'teal' : 'red'}
                  leftSection={
                    isDemoMode ? (
                      <IconSparkles size={12} />
                    ) : isConnected ? (
                      <IconWifi size={12} />
                    ) : (
                      <IconWifiOff size={12} />
                    )
                  }
                  size="sm"
                >
                  {isDemoMode
                    ? 'Demo Data'
                    : isConnected
                    ? 'Backend Live'
                    : 'Backend Offline'}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                TransLink GTFS-Realtime Telemetry & Live Arrivals
                {lastUpdated && ` • Updated at ${lastUpdated}`}
              </Text>
            </div>
          </Group>

          {/* Controls */}
          <Group gap="sm" wrap="wrap">
            <Switch
              size="sm"
              label="Demo Mode"
              checked={isDemoMode}
              onChange={(e) => toggleDemoMode(e.currentTarget.checked)}
              color="violet"
            />

            <Switch
              size="sm"
              label="Auto (30s)"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.currentTarget.checked)}
              color="cyan"
            />

            <Tooltip label="Refresh Feed Now">
              <Button
                variant="light"
                color="cyan"
                size="xs"
                leftSection={
                  <IconRefresh
                    size={16}
                    style={isLoading ? { animation: 'spin 1s linear infinite' } : {}}
                  />
                }
                loading={isLoading}
                onClick={() => fetchDashboardData()}
              >
                Refresh
              </Button>
            </Tooltip>

            <Tooltip label="Backend API Settings">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  setUrlInput(backendUrl);
                  setModalOpened(true);
                }}
              >
                <IconAdjustmentsHorizontal size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="FastAPI Backend Settings"
        centered
        styles={{
          content: { backgroundColor: '#16222f', color: '#f1f5f9' },
          header: { backgroundColor: '#16222f', color: '#f1f5f9' },
        }}
      >
        <TextInput
          label="Backend API Base URL"
          description="Default is http://localhost:8000"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="http://localhost:8000"
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalOpened(false)}>
            Cancel
          </Button>
          <Button color="cyan" onClick={handleSaveUrl}>
            Save & Connect
          </Button>
        </Group>
      </Modal>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
