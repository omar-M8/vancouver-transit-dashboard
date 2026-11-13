import { useState, useId } from 'react';
import {
  Card,
  Text,
  Group,
  TextInput,
  Button,
  Table,
  Badge,
  Stack,
  Paper,
  Box,
  Skeleton,
} from '@mantine/core';
import {
  IconSearch,
  IconMapPin,
  IconClock,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useTransitStore, POPULAR_STATIONS } from '../stores/useTransitStore';

export function StationBoard() {
  const {
    selectedStopId,
    selectedStopName,
    departures,
    setSelectedStop,
    isLoading,
  } = useTransitStore();

  const [inputStopId, setInputStopId] = useState(selectedStopId);
  const datalistId = useId();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = inputStopId.trim();
    if (!cleanId) return;
    const match = POPULAR_STATIONS.find((s) => s.id === cleanId);
    setSelectedStop(cleanId, match?.name || `Stop #${cleanId}`);
  };

  const handleSelectPreset = (id: string, name: string) => {
    setInputStopId(id);
    setSelectedStop(id, name);
  };

  const formatDelay = (seconds: number) => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const remainingSecs = absSeconds % 60;
    const timeStr = mins > 0 ? `${mins}m ${remainingSecs}s` : `${remainingSecs}s`;

    if (seconds > 60) return `+${timeStr}`;
    if (seconds < -60) return `-${timeStr}`;
    return '0s';
  };

  return (
    <Card
      p="lg"
      radius="md"
      style={{
        backgroundColor: '#131e2b',
        border: '1px solid #1e2e3d',
      }}
    >
      <Stack gap="md">
        {/* Top bar with Station search and title */}
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="xs">
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconMapPin size={18} color="#ffffff" />
            </Box>
            <div>
              <Text fw={700} size="md" c="#f1f5f9">
                {selectedStopName}
              </Text>
              <Text size="xs" c="dimmed">
                Stop ID: #{selectedStopId} • {departures.length} active arrival estimate{departures.length === 1 ? '' : 's'}
              </Text>
            </div>
          </Group>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TextInput
              size="xs"
              placeholder="Enter Station ID (e.g. 50915)"
              value={inputStopId}
              onChange={(e) => setInputStopId(e.currentTarget.value)}
              list={datalistId}
              leftSection={<IconSearch size={14} />}
              styles={{
                input: {
                  backgroundColor: '#0f172a',
                  borderColor: '#243547',
                  color: '#f1f5f9',
                  width: 220,
                },
              }}
            />
            <datalist id={datalistId}>
              {POPULAR_STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </datalist>
            <Button size="xs" color="cyan" type="submit" loading={isLoading}>
              Lookup
            </Button>
          </form>
        </Group>

        {/* Popular Station Quick Buttons */}
        <div>
          <Text size="xs" c="dimmed" mb={6} fw={600}>
            POPULAR STATIONS & HUBS:
          </Text>
          <Group gap="xs" wrap="wrap">
            {POPULAR_STATIONS.map((preset) => {
              const isSelected = preset.id === selectedStopId;
              return (
                <Button
                  key={preset.id}
                  size="compact-xs"
                  variant={isSelected ? 'filled' : 'subtle'}
                  color={isSelected ? 'cyan' : 'gray'}
                  onClick={() => handleSelectPreset(preset.id, preset.name)}
                  styles={{
                    root: {
                      border: isSelected ? 'none' : '1px solid #1e2e3d',
                      backgroundColor: isSelected ? undefined : '#0f172a',
                      color: isSelected ? undefined : '#94a3b8',
                    },
                  }}
                >
                  {preset.name} (#{preset.id})
                </Button>
              );
            })}
          </Group>
        </div>

        {/* Departures Table */}
        <Paper
          radius="md"
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e2e3d',
            overflow: 'hidden',
          }}
        >
          {isLoading && departures.length === 0 ? (
            <Stack p="md" gap="xs">
              <Skeleton height={35} radius="sm" />
              <Skeleton height={35} radius="sm" />
              <Skeleton height={35} radius="sm" />
            </Stack>
          ) : departures.length > 0 ? (
            <Table.ScrollContainer minWidth={580}>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead style={{ backgroundColor: '#16222f' }}>
                  <Table.Tr>
                    <Table.Th style={{ color: '#94a3b8' }}>ROUTE</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>TRIP ID</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>STOP SEQ</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>ESTIMATED DELAY</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>STATUS</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {departures.map((dep, idx) => {
                    const isLate = dep.status === 'LATE';
                    const isEarly = dep.status === 'EARLY';

                    return (
                      <Table.Tr key={`${dep.tripId}-${idx}`}>
                        <Table.Td>
                          <Badge
                            size="md"
                            variant="filled"
                            color={
                              dep.routeId.includes('99') || dep.routeId.startsWith('R')
                                ? 'teal'
                                : 'blue'
                            }
                            radius="sm"
                            fw={700}
                          >
                            {dep.routeId}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace" c="#94a3b8">
                            {dep.tripId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="#f1f5f9">
                            #{dep.stopSequence}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <IconClock
                              size={14}
                              color={isLate ? '#f87171' : isEarly ? '#60a5fa' : '#34d399'}
                            />
                            <Text
                              size="sm"
                              fw={600}
                              c={isLate ? '#f87171' : isEarly ? '#60a5fa' : '#34d399'}
                            >
                              {formatDelay(dep.delaySeconds)}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="sm"
                            variant="light"
                            color={isLate ? 'red' : isEarly ? 'blue' : 'teal'}
                            leftSection={
                              isLate ? (
                                <IconAlertTriangle size={12} />
                              ) : (
                                <IconCheck size={12} />
                              )
                            }
                          >
                            {dep.status === 'ON_TIME'
                              ? 'ON TIME'
                              : dep.status === 'LATE'
                              ? 'DELAYED'
                              : 'EARLY'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <Box p="xl" style={{ textAlign: 'center' }}>
              <Text size="md" fw={600} c="#94a3b8" mb="xs">
                No active arrivals broadcasting for stop #{selectedStopId} right now
              </Text>
              <Text size="xs" c="dimmed" mb="md" maw={450} mx="auto">
                TransLink GTFS-RT only broadcasts vehicles that are actively approaching or scheduled within the immediate real-time window. Try selecting a major hub like Broadway & Cambie or Burrard Station.
              </Text>
              <Button
                size="xs"
                variant="light"
                color="cyan"
                onClick={() => setSelectedStop('50915', 'Broadway & Cambie')}
              >
                Switch to Broadway & Cambie (#50915)
              </Button>
            </Box>
          )}
        </Paper>
      </Stack>
    </Card>
  );
}
